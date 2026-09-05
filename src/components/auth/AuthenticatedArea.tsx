"use client";

import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { SessionExpiryWatcher } from "./SessionExpiryWatcher";

/**
 * Enveloppe cliente montée par chaque layout serveur d'un espace authentifié
 * (élève / parent / admin / abonnement). Fournit le contexte `useSession()` et
 * monte le veilleur d'expiration (§2.7, point 4 : avertir / rediriger **avant**
 * que l'utilisateur découvre l'échec en soumettant un formulaire).
 *
 * `refetchInterval` (5 min) : re-valide la session périodiquement tant que
 * l'onglet est ouvert — ce qui, en pratique, **maintient la session vivante**
 * pendant qu'un formulaire long est rempli (rotation du cookie à chaque
 * refetch), et fait tomber un compte invalidé (anonymisé / supprimé) en moins
 * de 5 min sans action de l'utilisateur.
 */
export function AuthenticatedArea({ session, children }: { session: Session | null; children: ReactNode }) {
  return (
    <SessionProvider session={session} refetchInterval={300} refetchOnWindowFocus>
      <SessionExpiryWatcher />
      {children}
    </SessionProvider>
  );
}
