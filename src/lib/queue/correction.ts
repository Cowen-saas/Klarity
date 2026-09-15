import { Queue } from "bullmq";
import { createRedisConnection } from "@/lib/redis";

/**
 * File du pipeline de correction IA (§2.1, §4.3, §6.2, §6.4) — consommée par
 * le service `worker`, jamais par `app` : la route d'upload répond
 * immédiatement (TentativeEpreuve créée, statut EN_ATTENTE), le job réel
 * (appel Sonnet vision) tourne en tâche de fond et l'écran client sonde le
 * statut (cf. maquette 07). N'est jamais enqueue pour `numeroTentative > 1` —
 * seule la 1ère tentative déclenche un traitement (§2.1, §6.4).
 */
export const QUEUE_CORRECTION = "correction";

export interface CorrectionJobData {
  tentativeId: string;
}

let queue: Queue<CorrectionJobData> | undefined;

export function getCorrectionQueue(): Queue<CorrectionJobData> {
  if (!queue) {
    queue = new Queue<CorrectionJobData>(QUEUE_CORRECTION, { connection: createRedisConnection() });
  }
  return queue;
}

export async function planifierCorrection(tentativeId: string): Promise<void> {
  await getCorrectionQueue().add(
    "corriger",
    { tentativeId },
    { removeOnComplete: true, removeOnFail: 20 }
  );
}
