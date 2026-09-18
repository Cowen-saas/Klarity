import { Queue } from "bullmq";
import { createRedisConnection } from "@/lib/redis";

/**
 * File du job de réconciliation des paiements (voir
 * `src/lib/payment/reconciliation.ts` pour le pourquoi) — consommée par le
 * service `worker`, jamais `app`. Un seul job planifié par cron via les Job
 * Schedulers BullMQ (`upsertJobScheduler`, ré-enregistré à chaque démarrage du
 * worker, idempotent par identifiant de scheduler — même pattern que
 * `src/lib/queue/retention.ts`). N'a de sens qu'en PAYMENT_MODE=notchpay (le
 * mock ne reste jamais EN_ATTENTE au-delà de `DELAI_MOCK_MS`) : ni la file ni
 * le worker ne sont démarrés en mode mock, cf. `src/worker/index.ts`.
 */
export const QUEUE_RECONCILIATION_PAIEMENT = "reconciliation-paiement";

/** Toutes les 5 minutes — cohérent avec SEUIL_MINUTES dans reconciliation.ts. */
const CRON_RECONCILIATION = "*/5 * * * *";

let queue: Queue | undefined;

export function getReconciliationPaiementQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_RECONCILIATION_PAIEMENT, { connection: createRedisConnection() });
  }
  return queue;
}

/** Ré-enregistre le scheduler cron. Appelé au démarrage du worker. */
export async function enregistrerSchedulerReconciliationPaiement(q: Queue = getReconciliationPaiementQueue()): Promise<void> {
  await q.upsertJobScheduler(
    "reconciliation-paiement:cron",
    { pattern: CRON_RECONCILIATION },
    { name: "reconciliation-paiement", opts: { removeOnComplete: true, removeOnFail: 20 } }
  );
}

/** Déclenche immédiatement le job (tests / opérations manuelles), sans attendre le cron. */
export async function declencherReconciliationPaiement(q: Queue = getReconciliationPaiementQueue()): Promise<void> {
  await q.add("reconciliation-paiement", {}, { removeOnComplete: true, removeOnFail: 20 });
}
