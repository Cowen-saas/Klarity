// Élève/Parent uniquement (fidèle à 03/03b) — l'admin n'a jamais d'option
// visible ni cliquable ici, cf. /admin/connexion (§4.1 CDC).
type Role = "ELEVE" | "PARENT";

const ROLES: Array<{ value: Role; label: string }> = [
  { value: "ELEVE", label: "Élève" },
  { value: "PARENT", label: "Parent" },
];

interface RoleSwitcherProps {
  value: Role;
  onChange: (role: Role) => void;
  /** Verrouille sur `value` — l'autre onglet est grisé et non cliquable
   * (arrivée sur /connexion avec un paramètre `role` explicite, ex. depuis
   * le chooser d'abonnement §2.2/§2.6 : le choix élève/parent déjà fait ne
   * doit pas pouvoir être changé depuis cet écran contextualisé). */
  locked?: boolean;
}

export function RoleSwitcher({ value, onChange, locked = false }: RoleSwitcherProps) {
  return (
    <div className="mb-6 flex gap-2 rounded-full bg-fond p-1" role="tablist" aria-label="Type de compte">
      {ROLES.map((role) => {
        const actif = value === role.value;
        const verrouille = locked && !actif;
        return (
          <button
            key={role.value}
            type="button"
            role="tab"
            aria-selected={actif}
            aria-disabled={verrouille || undefined}
            disabled={verrouille}
            onClick={verrouille ? undefined : () => onChange(role.value)}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
              actif
                ? "bg-primary text-white"
                : verrouille
                  ? "cursor-not-allowed text-texte-muted/40"
                  : "text-texte-muted hover:text-texte"
            }`}
          >
            {role.label}
          </button>
        );
      })}
    </div>
  );
}

export type { Role };
