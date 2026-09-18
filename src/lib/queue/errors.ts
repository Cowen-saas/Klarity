/**
 * Levée quand une file d'attente BullMQ est inaccessible (Redis injoignable
 * ou mal configuré) — même principe que `RateLimitIndisponibleError`
 * (`src/lib/rate-limit.ts`) : avant ce garde-fou, `planifierQuizPourEleve`/
 * `planifierCorrection` faisaient planter leur route appelante sans être
 * rattrapées, produisant un corps d'erreur non-JSON et le message trompeur
 * "Impossible de contacter le serveur" côté client pour une panne
 * d'infrastructure serveur.
 */
export class FileAttenteIndisponibleError extends Error {
  constructor(cause: unknown) {
    super("File d'attente indisponible.");
    this.name = "FileAttenteIndisponibleError";
    this.cause = cause;
  }
}
