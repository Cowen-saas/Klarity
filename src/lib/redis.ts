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
