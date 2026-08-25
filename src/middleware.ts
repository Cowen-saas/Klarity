import { NextResponse, type NextRequest } from "next/server";
import { getMiddlewareSession } from "@/lib/auth/session";
import type { ActeurRole } from "@/types/next-auth";

/**
 * Séparation stricte des rôles appliquée côté middleware serveur, jamais
 * seulement côté UI (réf. sécurité §5, cahier des charges §7). La vérification
 * d'appartenance de la ressource précise (IDOR — un parent ne voit que SON
 * enfant, un élève que SES propres données) se fait en plus, par route, dans
 * les handlers API de Phase 1+ : ce middleware ne couvre que le gate de rôle.
 *
 * Utilise `getMiddlewareSession()` (décodage direct du JWT) plutôt que
 * `auth()` depuis `@/auth` : ce dernier embarque les providers Credentials,
 * dont `otp.ts` (`node:crypto`), incompatible avec l'Edge Runtime dans lequel
 * s'exécute le middleware — voir `src/lib/auth/session.ts` pour le détail.
 */
const ROLE_PAR_PREFIXE: Array<{ prefix: string; role: ActeurRole }> = [
  { prefix: "/admin", role: "ADMIN" },
  { prefix: "/parent", role: "PARENT" },
  { prefix: "/eleve", role: "ELEVE" },
];

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const zone = ROLE_PAR_PREFIXE.find(({ prefix }) => pathname.startsWith(prefix));
  if (!zone) {
    return NextResponse.next();
  }

  const session = await getMiddlewareSession(req);
  if (!session || session.role !== zone.role || session.error) {
    const url = new URL("/connexion", req.nextUrl.origin);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/parent/:path*", "/eleve/:path*"],
};
