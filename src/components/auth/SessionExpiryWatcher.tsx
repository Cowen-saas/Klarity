"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { connexionPourRole, redirigerVersConnexion } from "@/lib/api-client";
import { IconWarning } from "@/components/icons";

/**
 * Veille sur la session d'un espace authentifié (§2.7, point 4) :
 *
 * - **Session disparue pendant que l'onglet est ouvert** — invalidée
 *   (`session.error` : compte anonymisé/supprimé, échec de rotation) ou
 *   carrément absente (cookie expiré, déconnecté ailleurs) — → redirection
 *   **proactive**, sans attendre que l'utilisateur soumette quoi que ce soit.
 *   Repose sur `SessionProvider({ refetchInterval, refetchOnWindowFocus })`
 *   (`AuthenticatedArea`) : dès qu'un refetch périodique ou un retour de focus
 *   constate la disparition, `status` bascule et cet effet redirige — avant que
 *   l'utilisateur perde du temps sur un formulaire. Ne redirige que si la
 *   session était valide à l'instant d'avant (jamais au tout premier rendu :
 *   un visiteur jamais connecté n'a rien à voir avec une session "expirée").
 * - **Expiration proche** (le cookie de session, non renouvelable) → bandeau
 *   discret « Ta session expire bientôt » avec un bouton « Rester connecté » qui
 *   force une revalidation. Rare en usage normal (la session roule tant que
 *   l'onglet est ouvert), mais couvre le cas d'un onglet laissé ouvert très
 *   longtemps.
 */

const SEUIL_ALERTE_MS = 5 * 60 * 1000;

export function SessionExpiryWatcher() {
  const { data, status, update } = useSession();
  const [expireBientot, setExpireBientot] = useState(false);
  const dejaRedirige = useRef(false);
  const dejaAuthentifie = useRef(false);

  useEffect(() => {
    if (status === "loading") return;

    if (status !== "authenticated" || !data) {
      // La session a disparu APRÈS avoir été valide dans ce même onglet — le
      // signe d'une expiration/invalidation en cours d'usage, pas d'un simple
      // visiteur non connecté (que ce composant ne monte de toute façon jamais).
      if (dejaAuthentifie.current && !dejaRedirige.current) {
        dejaRedirige.current = true;
        redirigerVersConnexion();
      }
      return;
    }
    dejaAuthentifie.current = true;

    if (data.error && !dejaRedirige.current) {
      dejaRedirige.current = true;
      redirigerVersConnexion(connexionPourRole(data.user?.role));
      return;
    }

    const expiresAt = data.expires ? new Date(data.expires).getTime() : NaN;
    if (Number.isNaN(expiresAt)) return;

    function verifier() {
      const reste = expiresAt - Date.now();
      if (reste <= 0) {
        if (!dejaRedirige.current) {
          dejaRedirige.current = true;
          redirigerVersConnexion(connexionPourRole(data?.user?.role));
        }
        return;
      }
      setExpireBientot(reste <= SEUIL_ALERTE_MS);
    }

    verifier();
    const id = setInterval(verifier, 30_000);
    return () => clearInterval(id);
  }, [data, status]);

  if (!expireBientot) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-3 bg-accent px-4 py-2 text-sm font-medium text-white shadow"
    >
      <IconWarning className="h-4 w-4 shrink-0" weight="fill" aria-hidden="true" />
      <span>Ta session expire bientôt.</span>
      <button
        type="button"
        onClick={() => {
          setExpireBientot(false);
          void update();
        }}
        className="rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/30"
      >
        Rester connecté
      </button>
    </div>
  );
}
