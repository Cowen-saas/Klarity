import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAIProvider, MODELE_SONNET, type BaremeCorrection, type ExempleFewShot } from "@/lib/ai";
import { estimerCoutIA } from "@/lib/ai/pricing";
import { planifierRechercheVideo } from "@/lib/queue/video";

/**
 * Traitement réel d'une tentative de copie (§2.1, §4.3, §6.2, §6.4) — exécuté
 * uniquement par le worker BullMQ (`src/worker/index.ts`), jamais par une
 * route `app` (§3 : pas d'appel IA synchrone dans un handler de requête).
 *
 * Résolution du barème (§4.2.2) : si `Epreuve.typeExercice` est renseigné
 * (Français/Philosophie — saisi explicitement par l'admin, jamais déduit,
 * cf. `src/lib/epreuves/type-exercice.ts`), le barème vient de
 * `ExempleCorrection` (matiereId + typeExercice) et sert aussi de few-shot ;
 * sinon (matières scientifiques), le barème est le `corrigeReferenceKey` de
 * l'épreuve elle-même, transmis en pièce jointe par `ClaudeAIProvider`.
 *
 * Garde-fou "une seule correction, jamais un retraitement" (§2.1, §4.3, §6.4) :
 * re-vérifié ici, pas seulement à l'enqueue (cf. commentaire de la route
 * d'upload sur le choix de ne pas gater strictement sur `numeroTentative`) —
 * une `CorrectionDetail` déjà existante pour ce couple (épreuve, élève)
 * court-circuite le traitement sans jamais rappeler Sonnet.
 */
export async function traiterTentative(tentativeId: string): Promise<void> {
  const tentative = await prisma.tentativeEpreuve.findUnique({
    where: { id: tentativeId },
    include: { epreuve: { include: { matiere: true } } },
  });
  if (!tentative) {
    throw new Error(`TentativeEpreuve introuvable : ${tentativeId}`);
  }

  const dejaCorrigee = await prisma.correctionDetail.findUnique({
    where: { epreuveId_eleveId: { epreuveId: tentative.epreuveId, eleveId: tentative.eleveId } },
    select: { id: true },
  });
  if (dejaCorrigee) {
    console.warn(`[correction] tentative ${tentativeId} ignorée — CorrectionDetail déjà existante (${dejaCorrigee.id}).`);
    return;
  }

  await prisma.tentativeEpreuve.update({ where: { id: tentativeId }, data: { statut: "EN_TRAITEMENT" } });

  const { epreuve } = tentative;
  let bareme: BaremeCorrection;
  let exemplesFewShot: ExempleFewShot[] | undefined;

  if (epreuve.typeExercice) {
    const exemple = await prisma.exempleCorrection.findFirst({
      where: { matiereId: epreuve.matiereId, typeExercice: epreuve.typeExercice },
    });
    if (!exemple) {
      await prisma.tentativeEpreuve.update({ where: { id: tentativeId }, data: { statut: "ERREUR" } });
      throw new Error(
        `Aucun ExempleCorrection pour matiereId=${epreuve.matiereId} typeExercice=${epreuve.typeExercice} — ` +
          `épreuve ${epreuve.id} mal configurée.`
      );
    }
    bareme = { source: "exemple_correction", baremeStructure: exemple.baremeStructure };
    exemplesFewShot = [
      {
        enonceModele: exemple.enonceModele,
        baremeStructure: exemple.baremeStructure,
        exempleReponseModele: exemple.exempleReponseModele,
        notesMethodologiques: exemple.notesMethodologiques,
      },
    ];
  } else {
    bareme = { source: "corrige_reference", storageKey: epreuve.corrigeReferenceKey };
  }

  const imageKeys = tentative.photoUploadKeys as string[];

  let correction;
  try {
    correction = await getAIProvider().corrigerCopie(
      imageKeys,
      { epreuveId: epreuve.id, matiere: epreuve.matiere.nom, classe: epreuve.classe, filiere: epreuve.filiere },
      bareme,
      exemplesFewShot
    );
  } catch (err) {
    await prisma.tentativeEpreuve.update({ where: { id: tentativeId }, data: { statut: "ERREUR" } });
    throw err; // laisse BullMQ marquer le job failed (backoff natif du worker à défaut d'options dédiées)
  }

  try {
    await prisma.$transaction(async (tx) => {
      const detail = await tx.correctionDetail.create({
        data: {
          epreuveId: epreuve.id,
          eleveId: tentative.eleveId,
          matiereId: epreuve.matiereId,
          note: correction.note,
          pointsForts: correction.pointsForts,
          pointsManques: correction.pointsManques as unknown as Prisma.InputJsonValue,
          feedbackDetaille: correction.feedbackDetaille,
          modeleIA: MODELE_SONNET,
          tokensInput: correction.tokensInput,
          tokensOutput: correction.tokensOutput,
        },
      });

      await tx.tentativeEpreuve.update({
        where: { id: tentativeId },
        data: { statut: "TERMINE", dateTraitement: new Date() },
      });

      for (const pointManque of correction.pointsManques) {
        const existante = await tx.lacune.findFirst({
          where: { eleveId: tentative.eleveId, matiereId: epreuve.matiereId, notion: pointManque.notion, resolu: false },
        });
        if (existante) {
          await tx.lacune.update({
            where: { id: existante.id },
            data: { dateMiseAJour: new Date(), sourceTentativeId: detail.id },
          });
        } else {
          await tx.lacune.create({
            data: {
              eleveId: tentative.eleveId,
              matiereId: epreuve.matiereId,
              notion: pointManque.notion,
              niveauMaitrise: 0,
              sourceTentativeId: detail.id,
            },
          });
        }
      }

      await tx.usageIA.create({
        data: {
          eleveId: tentative.eleveId,
          matiereId: epreuve.matiereId,
          typeUsage: "CORRECTION",
          modele: "SONNET",
          tokensInput: correction.tokensInput,
          tokensOutput: correction.tokensOutput,
          coutEstime: estimerCoutIA("SONNET", correction.tokensInput, correction.tokensOutput),
        },
      });
    });
  } catch (err) {
    // Écriture DB échouée après un appel Sonnet déjà facturé (ex. sortie structurée
    // malformée par le modèle) — sans ce filet, la tentative restait bloquée
    // indéfiniment en EN_TRAITEMENT, sans possibilité de nouvelle tentative (bug
    // trouvé en testant le déclenchement du pipeline vidéo, §2.5).
    await prisma.tentativeEpreuve.update({ where: { id: tentativeId }, data: { statut: "ERREUR" } });
    throw err;
  }

  // Déclenche le pipeline vidéo (§2.5) pour chaque notion de lacune touchée — job
  // asynchrone, dédupliqué par notion (jobId), jamais bloquant pour la correction
  // elle-même. Le job lui-même sert le cache si une autre tentative a déjà traité
  // cette notion entre-temps (aucun nouvel appel YouTube/Haiku dans ce cas).
  const notionsUniques = new Set(correction.pointsManques.map((pm) => pm.notion));
  for (const notion of notionsUniques) {
    await planifierRechercheVideo({
      notion,
      matiereId: epreuve.matiereId,
      matiereNom: epreuve.matiere.nom,
      classe: epreuve.classe,
      filiere: epreuve.filiere,
    });
  }

  console.log(
    `[correction] tentative ${tentativeId} terminée — note ${correction.note}, ` +
      `${correction.pointsManques.length} lacune(s), ${correction.tokensInput}+${correction.tokensOutput} tokens.`
  );
}
