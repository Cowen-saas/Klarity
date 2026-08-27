interface Matiere {
  id: string;
  nom: string;
}

interface MatiereSwitcherProps {
  matieres: Matiere[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Sélecteur de matière (chips) — absent du crop de la maquette mais requis par
 * le flux (mode 1 = "élève ouvre une conversation par matière", §2.1, §4.4). */
export function MatiereSwitcher({ matieres, selectedId, onSelect }: MatiereSwitcherProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-3" role="radiogroup" aria-label="Matière">
      {matieres.map((matiere) => {
        const active = matiere.id === selectedId;
        return (
          <button
            key={matiere.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(matiere.id)}
            className={`shrink-0 rounded-full border-2 px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              active
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-texte-muted hover:border-primary/40"
            }`}
          >
            {matiere.nom}
          </button>
        );
      })}
    </div>
  );
}
