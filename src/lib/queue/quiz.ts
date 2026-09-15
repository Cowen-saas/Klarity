import { Queue } from "bullmq";
import { createRedisConnection } from "@/lib/redis";

/**
 * File du quiz journalier (§2.1, §4.3, §6.1) — job cron quotidien (worker,
 * jamais `app`) qui génère, pour chaque élève ayant au moins une lacune
 * active, un quiz Haiku ciblé sur sa matière la plus en difficulté. Aussi
 * déclenchable à la demande pour un seul élève (bouton "Générer mon quiz du
 * jour" si le cron n'est pas encore passé) — toujours asynchrone, jamais
 * d'appel IA inline dans une route (§3).
 */
export const QUEUE_QUIZ = "quiz";

export type JobQuiz = "quiz-journalier-tous";

export interface QuizEleveJobData {
  eleveId: string;
  /** Renseigné pour un quiz ciblé (§2.1, depuis "Mes lacunes") ; absent pour le quiz journalier à la demande. */
  lacuneId?: string;
}

const CRON_QUOTIDIEN = "0 5 * * *"; // 05:00 chaque jour

let queueTous: Queue | undefined;
let queueEleve: Queue<QuizEleveJobData> | undefined;

export function getQuizQueue(): Queue {
  if (!queueTous) {
    queueTous = new Queue(QUEUE_QUIZ, { connection: createRedisConnection() });
  }
  return queueTous;
}

/** Job dédié à un seul élève (génération à la demande) — file séparée du cron pour ne pas se marcher dessus. */
export function getQuizEleveQueue(): Queue<QuizEleveJobData> {
  if (!queueEleve) {
    queueEleve = new Queue<QuizEleveJobData>(`${QUEUE_QUIZ}-eleve`, { connection: createRedisConnection() });
  }
  return queueEleve;
}

export async function enregistrerSchedulerQuiz(q: Queue = getQuizQueue()): Promise<void> {
  await q.upsertJobScheduler(
    "quiz:journalier-tous",
    { pattern: CRON_QUOTIDIEN },
    { name: "quiz-journalier-tous", opts: { removeOnComplete: true, removeOnFail: 20 } }
  );
}

/** Déclenche le cron immédiatement pour tous les élèves (tests / opérations manuelles). */
export async function declencherJobQuizTous(q: Queue = getQuizQueue()): Promise<void> {
  await q.add("quiz-journalier-tous", {}, { removeOnComplete: true, removeOnFail: 20 });
}

/** Génération à la demande pour un seul élève — journalier (sans lacuneId) ou ciblé (avec). */
export async function planifierQuizPourEleve(eleveId: string, lacuneId?: string): Promise<void> {
  await getQuizEleveQueue().add(
    "generer-quiz-eleve",
    { eleveId, lacuneId },
    { removeOnComplete: true, removeOnFail: 20 }
  );
}
