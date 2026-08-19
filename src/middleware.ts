import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { ActeurRole } from "@/types/next-auth";

/**
 * Séparation stricte des rôles appliquée côté middleware serveur, jamais
 * seulement côté UI (réf. sécurité §5, cahier des charges §7). La vérification
 * d'appartenance de la ressource précise (IDOR — un parent ne voit que SON
 * enfant, un élève que SES propres données) se fait en plus, par route, dans
 * les handlers API de Phase 1+ : ce middleware ne couvre que le gate de rôle.
 */
const ROLE_PAR_PREFIXE: Array<{ prefix: string; role: ActeurRole }> = [
  { prefix: "/admin", role: "ADMIN" },
  { prefix: "/parent", role: "PARENT" },
  { prefix: "/eleve", role: "ELEVE" },
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const zone = ROLE_PAR_PREFIXE.find(({ prefix }) => pathname.startsWith(prefix));
  if (!zone) {
    return NextResponse.next();
  }

  const session = req.auth;
  if (!session || session.user.role !== zone.role || session.error) {
    const url = new URL("/connexion", req.nextUrl.origin);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/parent/:path*", "/eleve/:path*"],
};
