import { NextResponse } from "next/server";
import type { Session } from "@auth/core/types";
import { auth } from "@/auth";
import type { ActeurRole } from "@/types/next-auth";

/**
 * Contrôle d'authentification + de rôle **centralisé** pour les routes `/api/*`
 * (le middleware, lui, ne couvre que les pages — §7, réf. sécurité §5). Un seul
 * endroit dans le code plutôt qu'un `if (!session || session.error || …)`
 * recopié dans chaque handler.
 *
 * Distingue deux cas de 401 que l'ancien code confondait sous un « Non
 * autorisé. » opaque :
 *
 * - **Session absente / expirée / invalidée** (`!session` ou `session.error`) —
 *   renvoie une 401 **structurée** `{ code: "SESSION_EXPIREE", connexion }` que
 *   le client (`apiFetch`, `src/lib/api-client.ts`) intercepte pour rediriger
 *   proprement vers l'écran de connexion avec un message clair (§2.7).
 * - **Rôle simplement incorrect** — cas anormal (le middleware l'aurait déjà
 *   bloqué au niveau page) : 403 opaque, aucune redirection.
 */

export const CONNEXION_PAR_ROLE: Record<ActeurRole, string> = {
  ADMIN: "/admin/connexion",
  PARENT: "/connexion",
  ELEVE: "/connexion",
};

export const MESSAGE_SESSION_EXPIREE = "Ta session a expiré. Reconnecte-toi pour continuer.";

type Resultat =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

export async function exigerRole(roleAttendu: ActeurRole | ActeurRole[]): Promise<Resultat> {
  const roles = Array.isArray(roleAttendu) ? roleAttendu : [roleAttendu];
  const session = await auth();

  if (!session || session.error) {
    // Cible de reconnexion : celle du rôle encore lisible dans le token si on
    // l'a, sinon celle du premier rôle attendu par la route.
    const connexion = (session?.user?.role && CONNEXION_PAR_ROLE[session.user.role]) ?? CONNEXION_PAR_ROLE[roles[0]];
    return {
      ok: false,
      response: NextResponse.json(
        { error: MESSAGE_SESSION_EXPIREE, code: "SESSION_EXPIREE", connexion },
        { status: 401 },
      ),
    };
  }

  if (!roles.includes(session.user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Accès refusé." }, { status: 403 }),
    };
  }

  return { ok: true, session };
}
