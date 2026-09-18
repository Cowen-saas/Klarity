import { Redis } from "ioredis";

/**
 * Shared Redis connection factory for BullMQ (queues + jobs) and application-level
 * caching (§3, §8.5 — video/lacune cache, matières). `maxRetriesPerRequest: null` is
 * required by BullMQ's blocking connections; safe as a default here too.
 */
export function createRedisConnection(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  return new Redis(url, { maxRetriesPerRequest: null });
}

/**
 * Connexion Redis pour un usage requête/réponse **court** (rate limiting,
 * enqueue BullMQ déclenché depuis une route HTTP) — délibérément distincte de
 * `createRedisConnection()`. Vérifié réellement en local (Redis stoppé le
 * temps du test) : sur une connexion déjà établie puis coupée,
 * `maxRetriesPerRequest: null` fait attendre une commande **indéfiniment**
 * une reconnexion (`client.incr()` ne s'est ni résolu ni rejeté après plus de
 * 20s) — un `try/catch` autour de l'appel ne sert à rien si la promesse ne
 * se règle jamais. Une route HTTP ne doit jamais rester bloquée ainsi :
 * `commandTimeout`/`connectTimeout` font échouer rapidement une commande
 * bloquée plutôt que de laisser la requête pendre jusqu'au timeout de la
 * plateforme (Vercel), qui répondrait alors avec un corps non-JSON — cause
 * du message trompeur "Impossible de contacter le serveur" côté client.
 * Jamais utilisée pour un `Worker`/`QueueEvents` BullMQ (connexions
 * bloquantes de longue durée, qui gardent `createRedisConnection()`).
 */
export function createRedisConnectionCourte(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  return new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 3000, commandTimeout: 3000 });
}
