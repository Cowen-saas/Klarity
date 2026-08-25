import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import type { ActeurRole } from "@/types/next-auth";

/**
 * Lecture de session allégée pour le middleware Edge Runtime (§7, cloisonnement
 * de rôle). Décode directement le JWT de session via `getToken()` au lieu
 * d'importer `@/auth` : `src/auth.ts` embarque les trois providers Credentials,
 * dont `otp.ts` (`import { randomInt } from "node:crypto"`) — un module Node
 * natif que l'Edge Runtime ne sait pas bundler ("UnhandledSchemeError: Reading
 * from node:crypto"), ce qui faisait échouer la compilation du middleware et
 * renvoyait un 500 sur toute route protégée (`/admin`, `/parent`, `/eleve`).
 *
 * `getToken()` ne fait que déchiffrer le cookie JWT déjà émis avec
 * AUTH_SECRET — mêmes claims (`role`, `error`, ...) que `req.auth` dans
 * `@/auth`, sans tirer la config des providers.
 */
export interface MiddlewareSession {
  role: ActeurRole;
  error?: "AccountInvalidated" | "RefreshFailed";
}

export async function getMiddlewareSession(
  req: NextRequest
): Promise<MiddlewareSession | null> {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token?.role) return null;
  return { role: token.role, error: token.error };
}
