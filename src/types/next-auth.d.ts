export type ActeurRole = "ADMIN" | "PARENT" | "ELEVE";
export type AdminSubRole = "SUPERADMIN" | "ADMIN";

/**
 * next-auth v5's own package only re-exports `type { Session, User }` from
 * @auth/core (`export type { ... } from "@auth/core/types"`) instead of
 * declaring them locally — declaration merging requires augmenting the module
 * where the interface is nominally declared, so "next-auth"/"next-auth/jwt"
 * augmentation is a no-op here; @auth/core is the module that actually works.
 * `Session.user` is redefined outright (rather than intersected with the
 * default OAuth-oriented shape) since Klarity only uses Credentials providers
 * and has no use for `name`/`image`.
 */
declare module "@auth/core/types" {
  interface User {
    id: string;
    role: ActeurRole;
    adminRole?: AdminSubRole;
    nom?: string;
    codeEleve?: string;
    classe?: string;
    filiere?: string | null;
    telephone?: string;
    email?: string;
  }

  interface Session {
    user: User;
    accessTokenExpires?: number;
    /** Présent quand la rotation d'access token a échoué (§2.7, §7) — le compte
     * n'est plus valide (anonymisé, verrouillé) ou une erreur est survenue. */
    error?: "AccountInvalidated" | "RefreshFailed";
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: ActeurRole;
    adminRole?: AdminSubRole;
    nom?: string;
    codeEleve?: string;
    classe?: string;
    filiere?: string | null;
    telephone?: string;
    email?: string;
    accessTokenExpires?: number;
    error?: "AccountInvalidated" | "RefreshFailed";
  }
}
