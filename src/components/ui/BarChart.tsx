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
 *
 * Chaque colonne (barre + libellé) a une largeur plancher (`min-w-10`) et le
 * conteneur défile horizontalement (`overflow-x-auto`) : avec beaucoup de
 * points (ex. "14 derniers jours" côté parent, `/parent/temps-passe`), des
 * colonnes en `flex-1` sans plancher se compressaient sous la largeur
 * minimale de leur libellé ("lun 14"), débordant réellement la page mobile
 * de 139px (mesuré à 375px) plutôt que de rester lisibles en défilement.
 */
export function BarChart({ data, valueFormatter = (v) => String(v), emptyMessage }: BarChartProps) {
  const max = Math.max(0, ...data.map((d) => d.value));
  const aDesDonnees = max > 0;

  if (!aDesDonnees) {
    return (
      <div className="flex items-center justify-center text-sm text-texte-muted" style={{ height: HAUTEUR_ZONE_PX }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="flex items-end gap-3"
        role="img"
        aria-label={data.map((d) => `${d.label} : ${valueFormatter(d.value)}`).join(", ")}
      >
        {data.map((d) => {
          const hauteur = Math.max(HAUTEUR_MIN_BARRE_PX, Math.round((d.value / max) * HAUTEUR_ZONE_PX));
          return (
            <div
              key={d.label}
              className="flex min-w-10 flex-1 flex-col items-center gap-2"
              title={`${d.label} : ${valueFormatter(d.value)}`}
            >
              <div className="flex w-full items-end" style={{ height: HAUTEUR_ZONE_PX }}>
                <div className="w-full rounded-t-md bg-primary" style={{ height: hauteur }} />
              </div>
              <p className="w-full text-center text-xs whitespace-nowrap text-texte-muted">{d.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
