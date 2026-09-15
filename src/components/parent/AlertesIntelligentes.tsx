import type { AlertesEleve } from "@/lib/parent/alertes";

/**
 * Rendu partagé des 3 niveaux d'alerte (§2.2.2) — utilisé par la vue
 * d'ensemble et l'écran Progression, pour ne jamais avoir deux présentations
 * différentes des mêmes règles.
 */
export function AlertesIntelligentes({ alertes, nomEleve }: { alertes: AlertesEleve; nomEleve: string }) {
  const total = alertes.critiques.length + alertes.aSurveiller.length + alertes.info.length;

  if (total === 0) {
    return (
      <p className="mt-3 text-sm text-texte-muted">
        Pas encore d&apos;alerte — elles apparaîtront dès que {nomEleve} aura une activité à analyser.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {alertes.critiques.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold tracking-wide text-danger uppercase">Critique</p>
          {alertes.critiques.map((a, i) => (
            <p key={i} className="rounded-lg bg-danger-light px-3 py-2 text-sm text-texte">
              ● {a.texte}
            </p>
          ))}
        </div>
      )}
      {alertes.aSurveiller.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold tracking-wide text-accent uppercase">À surveiller</p>
          {alertes.aSurveiller.map((a, i) => (
            <p key={i} className="rounded-lg bg-accent-light px-3 py-2 text-sm text-texte">
              ⚠ {a.texte}
            </p>
          ))}
        </div>
      )}
      {alertes.info.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold tracking-wide text-success uppercase">Info</p>
          {alertes.info.map((a, i) => (
            <p key={i} className="rounded-lg bg-success-light px-3 py-2 text-sm text-texte">
              ✓ {a.texte}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
