import { Queue } from "bullmq";
import type { NiveauClasse, Filiere } from "@prisma/client";
import { createRedisConnection } from "@/lib/redis";

/**
 * File du pipeline vidéo automatisé (§2.5) — jamais un appel bloquant la
 * requête utilisateur (recherche YouTube + filtrage Haiku en tâche de fond,
 * worker dédié). `jobId = notion` : BullMQ déduplique nativement toute
 * nouvelle demande tant qu'un job pour cette même notion est encore en
 * attente/actif, évitant des recherches YouTube/Haiku concurrentes
 * redondantes pour la même notion (§2.5 point 4, cache mutualisé).
 */
export const QUEUE_VIDEO = "video";

export interface VideoJobData {
  notion: string;
  matiereId: string;
  matiereNom: string;
  classe: NiveauClasse;
  filiere?: Filiere | null;
}

let queue: Queue<VideoJobData> | undefined;

export function getVideoQueue(): Queue<VideoJobData> {
  if (!queue) {
    queue = new Queue<VideoJobData>(QUEUE_VIDEO, { connection: createRedisConnection() });
  }
  return queue;
}

export async function planifierRechercheVideo(data: VideoJobData): Promise<void> {
  await getVideoQueue().add("rechercher-videos", data, {
    jobId: data.notion,
    removeOnComplete: true,
    removeOnFail: 20,
  });
}
