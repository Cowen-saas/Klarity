interface BarChartPoint {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarChartPoint[];
  /** Formatte la valeur pour le texte accessible et l'infobulle native (title). */
  valueFormatter?: (value: number) => string;
  emptyMessage: string;
}

const HAUTEUR_ZONE_PX = 160;
const HAUTEUR_MIN_BARRE_PX = 4;

/**
 * Bar chart mono-série (magnitude dans le temps) — une seule teinte (primary),
 * pas de légende nécessaire à une seule série (cf. skill dataviz). État vide
 * explicite plutôt qu'un graphique à barres nulles muettes.
 */
export function BarChart({ data, valueFormatter = (v) => String(v), emptyMessage }: BarChartProps) {
  const max = Math.max(0, ...data.map((d) => d.value));
  const aDesDonnees = max > 0;

  return (
    <div>
      <div
        className="flex items-end gap-3"
        style={{ height: HAUTEUR_ZONE_PX }}
        role="img"
        aria-label={aDesDonnees ? data.map((d) => `${d.label} : ${valueFormatter(d.value)}`).join(", ") : emptyMessage}
      >
        {!aDesDonnees ? (
          <p className="flex h-full w-full items-center justify-center text-sm text-texte-muted">{emptyMessage}</p>
        ) : (
          data.map((d) => {
            const hauteur = Math.max(HAUTEUR_MIN_BARRE_PX, Math.round((d.value / max) * HAUTEUR_ZONE_PX));
            return (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-2" title={`${d.label} : ${valueFormatter(d.value)}`}>
                <div className="flex w-full items-end" style={{ height: HAUTEUR_ZONE_PX }}>
                  <div className="w-full rounded-t-md bg-primary" style={{ height: hauteur }} />
                </div>
              </div>
            );
          })
        )}
      </div>
      {aDesDonnees && (
        <div className="mt-2 flex gap-3">
          {data.map((d) => (
            <p key={d.label} className="flex-1 text-center text-xs text-texte-muted">
              {d.label}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
