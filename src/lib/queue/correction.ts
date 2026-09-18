import { Queue } from "bullmq";
import { createRedisConnectionCourte } from "@/lib/redis";
import { FileAttenteIndisponibleError } from "./errors";

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

/**
 * Connexion "courte" délibérément (cf. `createRedisConnectionCourte`,
 * `src/lib/redis.ts`) : ce `Queue` ne sert qu'à `.add()` depuis une route
 * HTTP, jamais à une opération bloquante — non utilisée par le worker
 * (qui consomme cette file via son propre nom, pas cet objet `Queue`).
 */
export function getCorrectionQueue(): Queue<CorrectionJobData> {
  if (!queue) {
    queue = new Queue<CorrectionJobData>(QUEUE_CORRECTION, { connection: createRedisConnectionCourte() });
  }
  return queue;
}

/**
 * Appelée uniquement depuis `POST /api/eleve/epreuves/[id]/tentatives` :
 * toute panne Redis est convertie en `FileAttenteIndisponibleError` plutôt
 * que de laisser planter la route sans réponse JSON propre.
 */
export async function planifierCorrection(tentativeId: string): Promise<void> {
  try {
    await getCorrectionQueue().add(
      "corriger",
      { tentativeId },
      { removeOnComplete: true, removeOnFail: 20 }
    );
  } catch (err) {
    throw new FileAttenteIndisponibleError(err);
  }
}
