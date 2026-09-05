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
const ROLE_PAR_PREFIXE: Array<{ prefix: string; role: ActeurRole; connexion: string }> = [
  { prefix: "/admin", role: "ADMIN", connexion: "/admin/connexion" },
  { prefix: "/parent", role: "PARENT", connexion: "/connexion" },
  { prefix: "/eleve", role: "ELEVE", connexion: "/connexion" },
];

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /admin/connexion est le seul point d'entrée public sous /admin — jamais lié
  // depuis l'UI, accessible seulement en connaissant l'URL exacte. C'est l'écran
  // où une session s'établit, pas une ressource à protéger ; sans cette
  // exception, le gate ci-dessous le redirigerait vers lui-même en boucle. Les
  // comptes admin eux-mêmes ne sont jamais créés ici ni via aucune route HTTP —
  // uniquement via `prisma/create-admin.ts`, un script CLI (§4.1 CDC).
  if (pathname === "/admin/connexion") {
    return NextResponse.next();
  }

  const zone = ROLE_PAR_PREFIXE.find(({ prefix }) => pathname.startsWith(prefix));
  if (!zone) {
    return NextResponse.next();
  }

  const session = await getMiddlewareSession(req);
  if (!session || session.role !== zone.role || session.error) {
    const url = new URL(zone.connexion, req.nextUrl.origin);
    url.searchParams.set("from", pathname + req.nextUrl.search);
    // Session partie en erreur (compte anonymisé/verrouillé, rotation échouée) :
    // on le signale pour afficher « Ta session a expiré » plutôt qu'un simple
    // écran de connexion (§2.7).
    if (session?.error) url.searchParams.set("raison", "expiree");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/parent/:path*", "/eleve/:path*"],
};
