import { createRedisConnection } from "@/lib/redis";
import type { Redis } from "ioredis";

let redis: Redis | undefined;

function getRedis(): Redis {
  if (!redis) {
    redis = createRedisConnection();
  }
  return redis;
}

/**
 * Fixed-window rate limiter backed by Redis. Returns true if the action is
 * allowed (and counts it), false once the limit is reached for the window —
 * used for IP + téléphone limiting on the OTP request flow (réf. sécurité §2,
 * cahier des charges §7 : "les deux, pas l'un ou l'autre").
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const client = getRedis();
  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, windowSeconds);
  }
  return count <= limit;
}
