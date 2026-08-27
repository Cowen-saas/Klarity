// Élève/Parent uniquement (fidèle à 03/03b) — l'admin n'a jamais d'option
// visible ni cliquable ici, cf. /admin/connexion (§4.1 CDC).
type Role = "ELEVE" | "PARENT";

const ROLES: Array<{ value: Role; label: string }> = [
  { value: "ELEVE", label: "Élève" },
  { value: "PARENT", label: "Parent" },
];

export function RoleSwitcher({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  return (
    <div className="mb-6 flex gap-2 rounded-full bg-fond p-1" role="tablist" aria-label="Type de compte">
      {ROLES.map((role) => (
        <button
          key={role.value}
          type="button"
          role="tab"
          aria-selected={value === role.value}
          onClick={() => onChange(role.value)}
          className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
            value === role.value ? "bg-primary text-white" : "text-texte-muted hover:text-texte"
          }`}
        >
          {role.label}
        </button>
      ))}
    </div>
  );
}

export type { Role };
