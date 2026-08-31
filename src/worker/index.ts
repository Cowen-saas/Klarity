import { Worker } from "bullmq";
import { createRedisConnection } from "@/lib/redis";
import { QUEUE_PAIEMENT_MOCK, type PaiementMockJobData } from "@/lib/queue/paiement";
import { traiterWebhookPaiement } from "@/lib/payment/webhook-handler";
import { signerWebhookMock } from "@/lib/payment/mock-provider";

/**
 * Entrypoint for the `worker` Compose service (§3, §3.1, §8.1) — runs in a process
 * separate from `app`, dedicated to BullMQ queues (correction de copie, génération de
 * quiz, notifications SMS/WhatsApp, rappel de renouvellement, rétention/anonymisation).
 * Phase 2 adds the first real processor: la simulation du webhook CamerPay en mode
 * mock (§5.2) — les autres files (correction, quiz, ...) restent à câbler en Phase 3+
 * aux côtés des fonctionnalités qui les alimentent.
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

  const shutdown = async () => {
    console.log("[worker] shutting down");
    await paiementMockWorker?.close();
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
