"use client";

import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { SessionExpiryWatcher } from "./SessionExpiryWatcher";

/**
 * Enveloppe cliente montée par chaque layout serveur d'un espace authentifié
 * (élève / parent / admin / abonnement). Fournit le contexte `useSession()` et
 * monte le veilleur d'expiration (§2.7 / §29, point 4 : avertir / rediriger
 * **avant** que l'utilisateur découvre l'échec en soumettant un formulaire).
 *
 * **Pas de `refetchInterval` (§30) — délibéré, pas un oubli.** Sous stratégie
 * JWT, `@auth/core` re-signe le cookie de session avec une échéance
 * `now + REFRESH_TOKEN_TTL_SECONDS` à **chaque** appel de
 * `GET /api/auth/session`, sans le throttle `updateAge` (24 h) — celui-ci ne
 * s'applique qu'à la stratégie "database", jamais au JWT (vérifié dans
 * `@auth/core/lib/actions/session.js`, cf. commentaire similaire dans
 * `src/auth.ts`, et confirmé par un test curl direct : un `auth()` isolé —
 * page serveur, route API — ne bouge PAS l'échéance du cookie, seul un vrai
 * `GET /api/auth/session` le fait). Un `refetchInterval` aurait donc
 * silencieusement repoussé la fenêtre de 30 jours toutes les 5 min tant qu'un
 * onglet restait ouvert, même totalement inactif — un onglet Klarity oublié
 * ouvert sur un appareil partagé (§1.2, public mineur) n'aurait alors plus
 * jamais de vraie expiration. Le renouvellement silencieux (« reste connecté
 * tant qu'utilisé au moins une fois dans la fenêtre ») reste garanti par de
 * vraies preuves d'activité : `SessionProvider` interroge déjà
 * `/api/auth/session` une fois à son montage (donc à chaque vraie navigation
 * — rechargement complet, premier accès à un espace authentifié) et à chaque
 * retour de focus sur l'onglet (`refetchOnWindowFocus`) — jamais sur un
 * minuteur aveugle indépendant de toute action réelle.
 */
export function AuthenticatedArea({ session, children }: { session: Session | null; children: ReactNode }) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus>
      <SessionExpiryWatcher />
      {children}
    </SessionProvider>
  );
}
