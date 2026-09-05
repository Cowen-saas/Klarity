import type { ActeurRole } from "@/types/next-auth";

/**
 * Client HTTP des composants client pour les appels `/api/*`, avec gestion
 * **centralisée** de l'expiration de session (§2.7).
 *
 * `apiFetch()` remplace `fetch()` sur tous les appels `/api/*` authentifiés :
 * quand le serveur renvoie la 401 structurée `{ code: "SESSION_EXPIREE" }`
 * émise par `exigerRole()` (`src/lib/auth/api-guard.ts`), il déclenche une
 * redirection vers l'écran de connexion adéquat avec `?from=<page courante>` et
 * `?raison=expiree` — au lieu de laisser chaque écran afficher un « Non
 * autorisé. » générique. La réponse 401 est quand même renvoyée à l'appelant :
 * le message clair du serveur s'affiche brièvement avant la navigation.
 */

const CONNEXION_PAR_ROLE: Record<ActeurRole, string> = {
  ADMIN: "/admin/connexion",
  PARENT: "/connexion",
  ELEVE: "/connexion",
};

/** Préfixes de destination autorisés après reconnexion, par rôle (anti open-redirect). */
const RETOUR_AUTORISE: Record<ActeurRole, string[]> = {
  ELEVE: ["/eleve", "/abonnement"],
  PARENT: ["/parent", "/abonnement"],
  ADMIN: ["/admin"],
};

const ACCUEIL_PAR_ROLE: Record<ActeurRole, string> = {
  ELEVE: "/eleve",
  PARENT: "/parent",
  ADMIN: "/admin",
};

/**
 * Valide `from` (issu de `?from=`) contre l'allowlist du rôle et retourne soit
 * cette cible, soit l'accueil du rôle. `/admin/connexion` est exclu pour éviter
 * une boucle de redirection.
 */
export function cibleRetour(from: string | null | undefined, role: ActeurRole): string {
  if (!from || !from.startsWith("/") || from.startsWith("//") || from.startsWith("/admin/connexion")) {
    return ACCUEIL_PAR_ROLE[role];
  }
  const chemin = from.split("?")[0];
  return RETOUR_AUTORISE[role].some((p) => chemin === p || chemin.startsWith(p + "/") || chemin.startsWith(p + "?"))
    ? from
    : ACCUEIL_PAR_ROLE[role];
}

let redirectionEnCours = false;

/**
 * Redirige vers l'écran de connexion en conservant la page courante dans
 * `?from=` et en signalant `?raison=expiree` (bannière côté connexion). Nav dure
 * volontaire : repart d'un état propre, sans résidu de state client.
 */
export function redirigerVersConnexion(connexion?: string) {
  if (typeof window === "undefined" || redirectionEnCours) return;
  redirectionEnCours = true;
  const from = window.location.pathname + window.location.search;
  const cible = new URL(connexion || "/connexion", window.location.origin);
  cible.searchParams.set("from", from);
  cible.searchParams.set("raison", "expiree");
  window.location.assign(cible.toString());
}

export function connexionPourRole(role: ActeurRole | undefined): string {
  return (role && CONNEXION_PAR_ROLE[role]) || "/connexion";
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);

  if (res.status === 401) {
    let connexion = "/connexion";
    try {
      const data = await res.clone().json();
      if (data?.code === "SESSION_EXPIREE") {
        if (typeof data.connexion === "string") connexion = data.connexion;
        redirigerVersConnexion(connexion);
      }
    } catch {
      // Corps 401 illisible / non JSON : on laisse l'appelant gérer.
    }
  }

  return res;
}
