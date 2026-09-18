import { createRedisConnectionCourte } from "@/lib/redis";
import type { Redis } from "ioredis";

let redis: Redis | undefined;

function getRedis(): Redis {
  if (!redis) {
    redis = createRedisConnectionCourte();
  }
  return redis;
}

/**
 * Levée quand Redis est injoignable ou mal configuré (`REDIS_URL` absent,
 * connexion refusée, timeout) — distincte d'un vrai dépassement de quota
 * (celui-ci retourne `false`, jamais une exception). Avant ce garde-fou,
 * une panne Redis faisait planter `checkRateLimit()` sans être rattrapée par
 * les routes appelantes (`/api/eleve/inscription`, `/api/auth/parent/request-otp`,
 * `/api/paiement/initier`) : le framework répondait alors avec un corps
 * d'erreur non-JSON, et le client affichait "Impossible de contacter le
 * serveur, vérifie ta connexion" — un message trompeur pour une panne
 * d'infrastructure serveur, jamais un problème de réseau côté élève/parent.
 */
export class RateLimitIndisponibleError extends Error {
  constructor(cause: unknown) {
    super("Service de limitation de débit indisponible.");
    this.name = "RateLimitIndisponibleError";
    this.cause = cause;
  }
}

/**
 * Fixed-window rate limiter backed by Redis. Returns true if the action is
 * allowed (and counts it), false once the limit is reached for the window —
 * used for IP + téléphone limiting on the OTP request flow (réf. sécurité §2,
 * cahier des charges §7 : "les deux, pas l'un ou l'autre"). Lève
 * `RateLimitIndisponibleError` si Redis est injoignable — jamais un
 * repli silencieux qui autoriserait implicitement l'action (le rate
 * limiting protège contre l'abus, un échec doit rester visible et fermé,
 * pas ouvert par défaut).
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const client = getRedis();
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, windowSeconds);
    }
    return count <= limit;
  } catch (err) {
    if (err instanceof RateLimitIndisponibleError) throw err;
    throw new RateLimitIndisponibleError(err);
  }
}
