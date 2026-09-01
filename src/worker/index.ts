import { Worker } from "bullmq";
import { createRedisConnection } from "@/lib/redis";
import { QUEUE_PAIEMENT_MOCK, type PaiementMockJobData } from "@/lib/queue/paiement";
import { QUEUE_RETENTION, enregistrerSchedulersRetention, type JobRetention } from "@/lib/queue/retention";
import { traiterWebhookPaiement } from "@/lib/payment/webhook-handler";
import { signerWebhookMock } from "@/lib/payment/mock-provider";
import { detecterInactivite } from "@/lib/retention/detection-inactivite";
import { anonymiserComptesExpires } from "@/lib/retention/anonymisation-auto";
import { archiverPhotosAncienneAnnee } from "@/lib/retention/archivage-photos";

/**
 * Entrypoint for the `worker` Compose service (§3, §3.1, §8.1) — runs in a process
 * separate from `app`, dedicated to BullMQ queues.
 *
 * Files actives :
 *  - `paiement-mock-webhook` (§5.2) — simulation du webhook CamerPay en mode mock.
 *  - `retention` (§2.9) — 3 jobs cron : détection d'inactivité, anonymisation
 *    automatique, archivage annuel des photos de copies.
 *
 * Les files correction/quiz/notifications restent à câbler aux côtés des
 * fonctionnalités qui les alimentent.
 */
async function main() {
  const connection = createRedisConnection();

  connection.on("connect", () => {
    console.log("[worker] connected to Redis");
  });
  connection.on("error", (err) => {
    console.error("[worker] Redis connection error", err);
  });

  // N'a de sens qu'en PAYMENT_MODE=mock — CamerPay en sandbox/live appellera
  // directement l'endpoint HTTP réel (/api/paiement/webhook), jamais cette file.
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

  await enregistrerSchedulersRetention();
  console.log("[worker] schedulers rétention enregistrés (detection + anonymisation hebdo, archivage annuel)");

  const shutdown = async () => {
    console.log("[worker] shutting down");
    await Promise.allSettled([paiementMockWorker?.close(), retentionWorker.close()]);
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
