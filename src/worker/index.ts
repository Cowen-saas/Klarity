import { Worker } from "bullmq";
import { createRedisConnection } from "@/lib/redis";
import { QUEUE_PAIEMENT_MOCK, type PaiementMockJobData } from "@/lib/queue/paiement";
import {
  QUEUE_RECONCILIATION_PAIEMENT,
  enregistrerSchedulerReconciliationPaiement,
} from "@/lib/queue/reconciliation-paiement";
import { QUEUE_RETENTION, enregistrerSchedulersRetention, type JobRetention } from "@/lib/queue/retention";
import { QUEUE_CORRECTION, type CorrectionJobData } from "@/lib/queue/correction";
import { QUEUE_QUIZ, getQuizEleveQueue, enregistrerSchedulerQuiz, type QuizEleveJobData } from "@/lib/queue/quiz";
import { QUEUE_VIDEO, type VideoJobData } from "@/lib/queue/video";
import { traiterWebhookPaiement } from "@/lib/payment/webhook-handler";
import { signerWebhookMock } from "@/lib/payment/mock-provider";
import { detecterInactivite } from "@/lib/retention/detection-inactivite";
import { anonymiserComptesExpires } from "@/lib/retention/anonymisation-auto";
import { archiverPhotosAncienneAnnee } from "@/lib/retention/archivage-photos";
import { traiterTentative } from "@/lib/correction/traiter-tentative";
import { reconcilierPaiementsEnAttente } from "@/lib/payment/reconciliation";
import {
  genererQuizJournalierPourEleve,
  genererQuizJournalierPourTousLesEleves,
  genererQuizCiblePourEleve,
} from "@/lib/quiz/generer-quiz";
import { obtenirVideosPourNotion, planifierVideosPourLacunesActives } from "@/lib/video/pipeline";

/**
 * Entrypoint for the `worker` Compose service (§3, §3.1, §8.1) — runs in a process
 * separate from `app`, dedicated to BullMQ queues.
 *
 * Files actives :
 *  - `paiement-mock-webhook` (§5.2) — simulation du webhook NotchPay en mode mock.
 *  - `reconciliation-paiement` — cron 5 min (PAYMENT_MODE=notchpay uniquement),
 *    rattrape un paiement resté EN_ATTENTE si le webhook NotchPay ne s'est
 *    jamais livré (cf. `src/lib/payment/reconciliation.ts`).
 *  - `retention` (§2.9) — 3 jobs cron : détection d'inactivité, anonymisation
 *    automatique, archivage annuel des photos de copies.
 *  - `correction` (§2.1, §4.3, §6.2, §6.4) — traitement asynchrone d'une
 *    tentative de copie (appel Sonnet vision), jamais inline dans une route.
 *  - `quiz` (cron quotidien, tous les élèves) et `quiz-eleve` (à la demande,
 *    journalier ou ciblé) (§2.1, §4.3, §6.1) — génération Haiku, jamais inline.
 *  - `video` (§2.5) — recherche YouTube + filtrage Haiku par notion,
 *    déclenchée en fin de correction et par le cron quiz journalier pour les
 *    lacunes actives plus anciennes ; jobId = notion (dédoublonnage natif).
 *
 * La file notifications reste à câbler aux côtés de la fonctionnalité qui l'alimente.
 */
async function main() {
  const connection = createRedisConnection();

  connection.on("connect", () => {
    console.log("[worker] connected to Redis");
  });
  connection.on("error", (err) => {
    console.error("[worker] Redis connection error", err);
  });

  // N'a de sens qu'en PAYMENT_MODE=mock — NotchPay appellera directement
  // l'endpoint HTTP réel (/api/paiement/webhook), jamais cette file.
  const paiementMockWorker =
    (process.env.PAYMENT_MODE ?? "mock") === "mock"
      ? new Worker<PaiementMockJobData>(
          QUEUE_PAIEMENT_MOCK,
          async (job) => {
            const payload = {
              sessionId: job.data.sessionId,
              statut: job.data.statutCible,
              montant: job.data.montant,
              devise: job.data.devise,
            };
            const signature = signerWebhookMock(payload);
            const resultat = await traiterWebhookPaiement(payload, signature);
            console.log(`[worker] paiement mock ${job.data.sessionId} -> ${resultat.traitementStatut}`);
          },
          { connection: createRedisConnection() }
        )
      : undefined;

  paiementMockWorker?.on("failed", (job, err) => {
    console.error(`[worker] échec traitement webhook mock ${job?.data.sessionId}`, err);
  });

  // N'a de sens qu'en PAYMENT_MODE=notchpay — le mock ne reste jamais EN_ATTENTE
  // au-delà de DELAI_MOCK_MS, rien à réconcilier pour lui.
  const reconciliationWorker =
    (process.env.PAYMENT_MODE ?? "mock") === "notchpay"
      ? new Worker(
          QUEUE_RECONCILIATION_PAIEMENT,
          async () => {
            const r = await reconcilierPaiementsEnAttente();
            console.log(
              `[worker] réconciliation paiements : ${r.verifies} vérifié(s), ${r.credites} crédité(s), ` +
                `${r.echecs} échec(s), ${r.toujoursEnAttente} toujours en attente, ${r.erreurs} erreur(s)`
            );
          },
          { connection: createRedisConnection() }
        )
      : undefined;

  reconciliationWorker?.on("failed", (job, err) => {
    console.error(`[worker] échec réconciliation paiements ${job?.name}`, err);
  });

  // --- Rétention des données (§2.9) ---
  const retentionWorker = new Worker(
    QUEUE_RETENTION,
    async (job) => {
      const nom = job.name as JobRetention;
      switch (nom) {
        case "detection-inactivite": {
          const r = await detecterInactivite();
          console.log(
            `[worker] rétention detection-inactivite : ${r.comptesTraites} compte(s) -> INACTIF_NOTIFIE, ` +
              `${r.smsEnvoyes} SMS, ${r.comptesSansCanal} sans canal (seuil ${r.seuilJours}j)`
          );
          return;
        }
        case "anonymisation-auto": {
          const r = await anonymiserComptesExpires();
          console.log(
            `[worker] rétention anonymisation-auto : ${r.comptesAnonymises} compte(s) anonymisé(s), ` +
              `${r.erreurs} erreur(s) (grâce ${r.delaiGraceJours}j)`
          );
          return;
        }
        case "archivage-photos": {
          const r = await archiverPhotosAncienneAnnee();
          console.log(
            `[worker] rétention archivage-photos : ${r.tentativesArchivees} tentative(s), ` +
              `${r.photosSupprimees} photo(s) purgée(s) (< ${r.anneeScolairePivot})`
          );
          return;
        }
        default:
          throw new Error(`[worker] job rétention inconnu : ${job.name}`);
      }
    },
    { connection: createRedisConnection() }
  );

  retentionWorker.on("failed", (job, err) => {
    console.error(`[worker] échec job rétention ${job?.name}`, err);
  });

  // --- Pipeline de correction IA (§2.1, §4.3, §6.2, §6.4) ---
  const correctionWorker = new Worker<CorrectionJobData>(
    QUEUE_CORRECTION,
    async (job) => {
      await traiterTentative(job.data.tentativeId);
    },
    { connection: createRedisConnection() }
  );

  correctionWorker.on("failed", (job, err) => {
    console.error(`[worker] échec correction tentative ${job?.data.tentativeId}`, err);
  });

  // --- Quiz journalier (§2.1, §4.3, §6.1) — cron quotidien (tous les élèves) ---
  const quizCronWorker = new Worker(
    QUEUE_QUIZ,
    async () => {
      const r = await genererQuizJournalierPourTousLesEleves();
      console.log(`[worker] quiz journalier (cron) : ${r.generes} généré(s), ${r.ignores} ignoré(s), ${r.erreurs} erreur(s)`);

      // Compatibilité pipeline vidéo (§2.5 point 1) — même tick que le cron quiz,
      // pour les Lacune actives plus anciennes dont la notion n'a encore jamais
      // été traitée (ou dont le cache a expiré), sans attendre une nouvelle correction.
      const v = await planifierVideosPourLacunesActives();
      console.log(`[worker] pipeline vidéo (cron) : ${v.planifiees} recherche(s) planifiée(s)`);
    },
    { connection: createRedisConnection() }
  );
  quizCronWorker.on("failed", (job, err) => {
    console.error(`[worker] échec cron quiz journalier ${job?.name}`, err);
  });

  // --- Pipeline vidéo automatisé (§2.5) — jamais inline dans une route/job appelant ---
  const videoWorker = new Worker<VideoJobData>(
    QUEUE_VIDEO,
    async (job) => {
      const { videos, depuisCache } = await obtenirVideosPourNotion(job.data);
      console.log(
        `[worker] pipeline vidéo notion "${job.data.notion}" -> ${videos.length} vidéo(s) ` +
          (depuisCache ? "servie(s) depuis le cache (aucun appel réseau)." : "retenue(s) après recherche YouTube + filtrage Haiku réels.")
      );
    },
    { connection: createRedisConnection() }
  );
  videoWorker.on("failed", (job, err) => {
    console.error(`[worker] échec pipeline vidéo notion "${job?.data.notion}"`, err);
  });

  // --- Quiz à la demande (un seul élève — bouton "Générer mon quiz du jour" ou quiz ciblé) ---
  const quizEleveWorker = new Worker<QuizEleveJobData>(
    getQuizEleveQueue().name,
    async (job) => {
      const id = job.data.lacuneId
        ? await genererQuizCiblePourEleve(job.data.eleveId, job.data.lacuneId)
        : await genererQuizJournalierPourEleve(job.data.eleveId);
      console.log(`[worker] quiz à la demande élève ${job.data.eleveId} -> ${id ?? "aucun (lacune introuvable/déjà résolue)"}`);
    },
    { connection: createRedisConnection() }
  );
  quizEleveWorker.on("failed", (job, err) => {
    console.error(`[worker] échec quiz à la demande ${job?.data.eleveId}`, err);
  });

  await enregistrerSchedulersRetention();
  console.log("[worker] schedulers rétention enregistrés (detection + anonymisation hebdo, archivage annuel)");

  await enregistrerSchedulerQuiz();
  console.log("[worker] scheduler quiz journalier enregistré (quotidien 05:00)");

  if (reconciliationWorker) {
    await enregistrerSchedulerReconciliationPaiement();
    console.log("[worker] scheduler réconciliation paiements enregistré (toutes les 5 min)");
  }

  const shutdown = async () => {
    console.log("[worker] shutting down");
    await Promise.allSettled([
      paiementMockWorker?.close(),
      reconciliationWorker?.close(),
      retentionWorker.close(),
      correctionWorker.close(),
      quizCronWorker.close(),
      quizEleveWorker.close(),
      videoWorker.close(),
    ]);
    await connection.quit();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[worker] fatal startup error", err);
  process.exit(1);
});
