import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payment";
import type { ResultatPaiement } from "@/lib/payment/types";

/**
 * Traitement d'un webhook de paiement (§5.4) — point d'entrée unique partagé
 * par le vrai endpoint HTTP (`/api/paiement/webhook`, celui que NotchPay
 * appellera) et par le job BullMQ qui simule l'arrivée asynchrone du webhook
 * en mode mock (§5.2 : « pop-up de confirmation branché sur MockPaymentProvider
 * qui simule REUSSI/ECHEC après un court délai »). Partager cette fonction
 * garantit qu'aucun retravail de l'endpoint n'est nécessaire au changement de
 * provider — seul PaymentProvider change (§5.3).
 *
 * Idempotence stricte (§4.5, §5.4, §8) : un même événement rejoué (retry
 * réseau NotchPay, ou le même job mock relancé) ne crédite jamais deux fois —
 * dès que Paiement.statut a quitté EN_ATTENTE, tout replay est un no-op
 * journalisé, jamais une seconde écriture sur Abonnement. Cette même garantie
 * est réutilisée telle quelle par `reconcilierPaiementsEnAttente()`
 * (`src/lib/payment/reconciliation.ts`), qui appelle `appliquerResultatPaiement`
 * ci-dessous avec un résultat obtenu par interrogation directe du provider
 * plutôt que par un webhook reçu — même chemin de crédit, même garde-fou.
 */

const DUREE_ABONNEMENT_JOURS = 30;

export type StatutTraitement = "CREDITE" | "ECHEC_PAIEMENT" | "DEJA_TRAITE" | "EVENEMENT_INTERMEDIAIRE" | "PAIEMENT_INTROUVABLE";

export type ResultatTraitementWebhook =
  | { ok: true; traitementStatut: Exclude<StatutTraitement, "PAIEMENT_INTROUVABLE"> }
  | { ok: false; traitementStatut: "SIGNATURE_INVALIDE" | "PAIEMENT_INTROUVABLE"; status: 401 | 404 };

export async function traiterWebhookPaiement(
  payloadBrut: unknown,
  signatureRecue: string
): Promise<ResultatTraitementWebhook> {
  const provider = getPaymentProvider();
  // Journalisé explicitement à chaque écriture (WebhookLog.provider n'a plus de
  // défaut, v1.32) — reflète le provider effectivement actif au moment du
  // traitement.
  const nomProvider = (process.env.PAYMENT_MODE ?? "mock").toUpperCase();

  if (!provider.verifierSignatureWebhook(payloadBrut, signatureRecue)) {
    await Promise.all([
      prisma.webhookLog.create({
        data: { provider: nomProvider, payloadBrut: asJson(payloadBrut), signatureValide: false, traitementStatut: "SIGNATURE_INVALIDE" },
      }),
      prisma.auditLogSecurite.create({ data: { typeEvenement: "WEBHOOK_INVALID" } }),
    ]);
    return { ok: false, traitementStatut: "SIGNATURE_INVALIDE", status: 401 };
  }

  const resultat = await provider.traiterWebhook(payloadBrut);
  const traitementStatut = await appliquerResultatPaiement(resultat, {
    nomProvider,
    payloadBrut: asJson(payloadBrut),
    signatureValide: true,
  });

  if (traitementStatut === "PAIEMENT_INTROUVABLE") {
    return { ok: false, traitementStatut: "PAIEMENT_INTROUVABLE", status: 404 };
  }
  return { ok: true, traitementStatut };
}

/**
 * Cœur idempotent partagé entre le webhook réel et la réconciliation
 * périodique (§ réconciliation, ajouté suite à un paiement sandbox resté bloqué
 * en local faute de webhook livrable — cf. `docs/PROGRESS.md`). `signatureValide`
 * reflète la provenance de `resultat`, jamais une vraie signature webhook côté
 * réconciliation : `true` car ces données viennent d'un appel authentifié par
 * notre propre clé API vers le provider (GET direct), pas d'un payload poussé
 * non vérifié — la confiance vient de qui a initié l'appel, pas d'une signature.
 */
export async function appliquerResultatPaiement(
  resultat: ResultatPaiement,
  contexte: { nomProvider: string; payloadBrut: object; signatureValide: boolean }
): Promise<StatutTraitement> {
  const { nomProvider, payloadBrut, signatureValide } = contexte;

  const paiement = await prisma.paiement.findUnique({
    where: { idempotencyKey: resultat.idempotencyKey },
    select: { id: true, statut: true, abonnementId: true },
  });

  if (!paiement) {
    await prisma.webhookLog.create({
      data: { provider: nomProvider, payloadBrut, signatureValide, traitementStatut: "PAIEMENT_INTROUVABLE" },
    });
    return "PAIEMENT_INTROUVABLE";
  }

  if (paiement.statut !== "EN_ATTENTE") {
    // Replay (retry réseau NotchPay, job mock rejoué, ou réconciliation arrivant
    // après qu'un webhook a déjà fait le travail) — no-op volontaire, aucune
    // seconde écriture sur Abonnement.
    await prisma.webhookLog.create({
      data: { provider: nomProvider, payloadBrut, signatureValide, traitementStatut: "DEJA_TRAITE" },
    });
    return "DEJA_TRAITE";
  }

  if (resultat.statut === "EN_ATTENTE") {
    // Événement intermédiaire (ex. NotchPay "processing") — pas encore un
    // état terminal : journalisé pour audit, mais ni Paiement ni Abonnement ne
    // sont modifiés. Le paiement reste EN_ATTENTE jusqu'au prochain événement
    // terminal (webhook ou réconciliation).
    await prisma.webhookLog.create({
      data: { provider: nomProvider, payloadBrut, signatureValide, traitementStatut: "EVENEMENT_INTERMEDIAIRE" },
    });
    return "EVENEMENT_INTERMEDIAIRE";
  }

  await prisma.$transaction(async (tx) => {
    await tx.paiement.update({
      where: { id: paiement.id },
      data: { statut: resultat.statut, referenceTransaction: resultat.referenceTransaction },
    });

    if (resultat.statut === "REUSSI") {
      const maintenant = new Date();
      const dateFin = new Date(maintenant.getTime() + DUREE_ABONNEMENT_JOURS * 24 * 60 * 60 * 1000);
      await tx.abonnement.update({
        where: { id: paiement.abonnementId },
        data: {
          plan: "PREMIUM",
          statut: "ACTIF",
          dateDebut: maintenant,
          dateFin,
          prixApplique: resultat.montant,
          dateProchainRenouvellement: dateFin,
          rappelEnvoye: false,
        },
      });
    }
  });

  const traitementStatut = resultat.statut === "REUSSI" ? "CREDITE" : "ECHEC_PAIEMENT";
  await prisma.webhookLog.create({
    data: { provider: nomProvider, payloadBrut, signatureValide, traitementStatut },
  });
  return traitementStatut;
}

function asJson(value: unknown): object {
  return value && typeof value === "object" ? (value as object) : { valeur: value };
}
