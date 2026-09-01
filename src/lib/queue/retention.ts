import { Queue } from "bullmq";
import { createRedisConnection } from "@/lib/redis";

/**
 * File des jobs de rétention des données (§2.9) — consommée par le service
 * `worker` (jamais `app`, §3.1, §8.1). Trois jobs planifiés par cron via les
 * Job Schedulers BullMQ, ré-enregistrés à chaque démarrage du worker
 * (`upsertJobScheduler` est idempotent par identifiant de scheduler) :
 *
 *  - `detection-inactivite`   — hebdomadaire : ACTIF -> INACTIF_NOTIFIE + SMS
 *  - `anonymisation-auto`     — hebdomadaire : INACTIF_NOTIFIE expiré -> ANONYMISE
 *  - `archivage-photos`       — annuel : purge des photos de copies anciennes
 *
 * Les jobs sont aussi déclenchables à la main (`declencherJobRetention`) pour
 * les tests, sans attendre le cron.
 */
export const QUEUE_RETENTION = "retention";

export type JobRetention = "detection-inactivite" | "anonymisation-auto" | "archivage-photos";

const CRON: Record<JobRetention, string> = {
  // Lundi 03:00 puis 04:00 — l'anonymisation passe après la détection.
  "detection-inactivite": "0 3 * * 1",
  "anonymisation-auto": "0 4 * * 1",
  // 1er août 05:00 — avant la bascule d'année scolaire.
  "archivage-photos": "0 5 1 8 *",
};

let queue: Queue | undefined;

export function getRetentionQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_RETENTION, { connection: createRedisConnection() });
  }
  return queue;
}

/** Ré-enregistre les 3 schedulers cron. Appelé au démarrage du worker. */
export async function enregistrerSchedulersRetention(q: Queue = getRetentionQueue()): Promise<void> {
  for (const nom of Object.keys(CRON) as JobRetention[]) {
    await q.upsertJobScheduler(
      `retention:${nom}`,
      { pattern: CRON[nom] },
      { name: nom, opts: { removeOnComplete: true, removeOnFail: 20 } }
    );
  }
}

/** Déclenche immédiatement un job (tests / opérations manuelles). */
export async function declencherJobRetention(nom: JobRetention, q: Queue = getRetentionQueue()): Promise<void> {
  await q.add(nom, {}, { removeOnComplete: true, removeOnFail: 20 });
}
