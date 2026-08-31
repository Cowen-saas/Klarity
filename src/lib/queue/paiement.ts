import { Queue } from "bullmq";
import { createRedisConnection } from "@/lib/redis";

/**
 * File dédiée à la simulation du délai de confirmation Mobile Money en mode
 * PAYMENT_MODE=mock (§5.2) — le worker (src/worker/index.ts) consomme cette
 * file après un court délai et rejoue le même chemin de traitement que le
 * futur vrai webhook CamerPay (src/lib/payment/webhook-handler.ts), pour ne
 * jamais avoir à retravailler ce chemin au passage sandbox/live (§5.3).
 * N'existe qu'en mode mock : CamerPaySandboxProvider/LiveProvider appelleront
 * directement l'endpoint HTTP réel, jamais cette file.
 */
export const QUEUE_PAIEMENT_MOCK = "paiement-mock-webhook";

export interface PaiementMockJobData {
  sessionId: string;
  statutCible: "REUSSI" | "ECHEC";
  montant: number;
  devise: string;
}

/** Délai fixe (plutôt qu'aléatoire) pour des tests manuels reproductibles. */
export const DELAI_MOCK_MS = 3000;

let queue: Queue<PaiementMockJobData> | undefined;

export function getPaiementMockQueue(): Queue<PaiementMockJobData> {
  if (!queue) {
    queue = new Queue<PaiementMockJobData>(QUEUE_PAIEMENT_MOCK, { connection: createRedisConnection() });
  }
  return queue;
}

export async function planifierWebhookMock(data: PaiementMockJobData): Promise<void> {
  await getPaiementMockQueue().add("simuler-webhook", data, {
    delay: DELAI_MOCK_MS,
    removeOnComplete: true,
    removeOnFail: true,
  });
}
