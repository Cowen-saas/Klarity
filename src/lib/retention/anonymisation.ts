import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage";

/**
 * Anonymisation d'un compte élève (§2.9.1, §2.9.2) — logique partagée par le
 * job hebdomadaire automatique et la clôture manuelle immédiate par le parent.
 *
 * Irréversible et idempotente : rejouer sur un compte déjà `ANONYMISE` ne fait
 * rien. Supprime tout le contenu pédagogique identifiable, puis anonymise la
 * *ligne* `Eleve` (nom générique + PIN invalidé) au lieu de la supprimer — pour
 * garder l'intégrité référentielle avec `Abonnement`/`Paiement`, conservés pour
 * raisons légales comptables (§2.9.4).
 *
 * Ne touche jamais : `OtpVerification`, `Paiement`, `Abonnement`, `WebhookLog`,
 * `AuditLogSecurite`, `UsageIA` (coûts/ops, dé-identifié de fait — compteurs de
 * tokens) — cf. §2.9.4.
 */

export type SourceAnonymisation =
  | { type: "AUTO" }
  | { type: "MANUEL"; parentId: string; parentTelephone: string };

const NOM_ANONYME = "Élève anonymisé";
/** Valeur qui ne peut correspondre à aucun hash bcrypt — verrouille toute tentative de connexion. */
const PIN_HASH_INVALIDE = "ANONYMISE";

export interface ResultatAnonymisation {
  eleveId: string;
  dejaAnonymise: boolean;
  contenuSupprime: {
    tentatives: number;
    corrections: number;
    lacunes: number;
    quiz: number;
    conversations: number;
    sessions: number;
    liensParent: number;
    photosSupprimeesDuStockage: number;
  };
}

export async function anonymiserEleve(
  eleveId: string,
  source: SourceAnonymisation
): Promise<ResultatAnonymisation> {
  const eleve = await prisma.eleve.findUnique({
    where: { id: eleveId },
    select: { id: true, statutCompte: true, dateNotificationInactivite: true },
  });
  if (!eleve) {
    throw new Error(`anonymiserEleve : élève ${eleveId} introuvable.`);
  }

  if (eleve.statutCompte === "ANONYMISE") {
    return {
      eleveId,
      dejaAnonymise: true,
      contenuSupprime: {
        tentatives: 0,
        corrections: 0,
        lacunes: 0,
        quiz: 0,
        conversations: 0,
        sessions: 0,
        liensParent: 0,
        photosSupprimeesDuStockage: 0,
      },
    };
  }

  // 1) Suppression des objets de stockage (photos de copies) — hors transaction
  //    DB : I/O externe, best-effort, la suite ne doit pas être bloquée par un
  //    fichier déjà absent.
  const tentatives = await prisma.tentativeEpreuve.findMany({
    where: { eleveId },
    select: { id: true, photoUploadKeys: true },
  });
  const storage = getStorageProvider();
  let photosSupprimeesDuStockage = 0;
  for (const t of tentatives) {
    const cles = Array.isArray(t.photoUploadKeys) ? (t.photoUploadKeys as unknown[]) : [];
    for (const cle of cles) {
      if (typeof cle !== "string") continue;
      try {
        await storage.supprimer(cle);
        photosSupprimeesDuStockage += 1;
      } catch {
        // Fichier déjà absent / stockage indisponible : on continue, la ligne DB
        // part de toute façon.
      }
    }
  }

  // 2) Suppression du contenu + anonymisation de la ligne, en une transaction.
  const resultat = await prisma.$transaction(async (tx) => {
    const conversations = await tx.conversationChat.findMany({ where: { eleveId }, select: { id: true } });
    await tx.messageChat.deleteMany({ where: { conversationId: { in: conversations.map((c) => c.id) } } });
    const convDel = await tx.conversationChat.deleteMany({ where: { eleveId } });

    const quizIds = (await tx.quiz.findMany({ where: { eleveId }, select: { id: true } })).map((q) => q.id);
    await tx.quizQuestion.deleteMany({ where: { quizId: { in: quizIds } } });
    const quizDel = await tx.quiz.deleteMany({ where: { eleveId } });

    const lacunesDel = await tx.lacune.deleteMany({ where: { eleveId } });
    const correctionsDel = await tx.correctionDetail.deleteMany({ where: { eleveId } });
    const tentativesDel = await tx.tentativeEpreuve.deleteMany({ where: { eleveId } });
    const sessionsDel = await tx.sessionActivite.deleteMany({ where: { eleveId } });
    const liensDel = await tx.parentEleveLink.deleteMany({ where: { eleveId } });

    await tx.eleve.update({
      where: { id: eleveId },
      data: {
        nom: NOM_ANONYME,
        pinHash: PIN_HASH_INVALIDE,
        pinTentativesEchouees: 0,
        pinVerrouilleJusqua: null,
        statutCompte: "ANONYMISE",
        dateAnonymisation: new Date(),
      },
    });

    const contenuSupprime = {
      tentatives: tentativesDel.count,
      corrections: correctionsDel.count,
      lacunes: lacunesDel.count,
      quiz: quizDel.count,
      conversations: convDel.count,
      sessions: sessionsDel.count,
      liensParent: liensDel.count,
      photosSupprimeesDuStockage,
    };

    await tx.auditLogSecurite.create({
      data: {
        typeEvenement: source.type === "AUTO" ? "COMPTE_ANONYMISE_AUTO" : "COMPTE_ANONYMISE_MANUEL",
        utilisateurId: eleveId,
        details:
          source.type === "AUTO"
            ? { source: "job-hebdomadaire", contenuSupprime }
            : {
                source: "cloture-manuelle-parent",
                parentId: source.parentId,
                parentTelephone: source.parentTelephone,
                contenuSupprime,
              },
      },
    });

    return contenuSupprime;
  });

  return { eleveId, dejaAnonymise: false, contenuSupprime: resultat };
}
