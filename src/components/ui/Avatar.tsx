import { genererAvatar } from "@/lib/avatar";

interface AvatarProps {
  /** Identifiant unique servant de graine — toujours `Eleve.id`, jamais une valeur devinable/réutilisable. */
  seed: string;
  nom?: string;
  size?: number;
  className?: string;
}

/** Avatar de compte élève (§4.1) — pas de session/état client requis, s'affiche identique côté serveur. */
export function Avatar({ seed, nom, size = 40, className = "" }: AvatarProps) {
  const { teinte, cellules } = genererAvatar(seed);
  const couleurCellule = `hsl(${teinte} 55% 42%)`;
  const couleurFond = `hsl(${teinte} 60% 92%)`;

  return (
    <div
      role="img"
      aria-label={nom ? `Avatar de ${nom}` : "Avatar"}
      className={`shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 5 5" width="100%" height="100%" aria-hidden="true">
        <rect width={5} height={5} fill={couleurFond} />
        {cellules.flatMap((ligne, l) =>
          ligne.map(
            (remplie, c) =>
              remplie && <rect key={`${l}-${c}`} x={c} y={l} width={1} height={1} fill={couleurCellule} />
          )
        )}
      </svg>
    </div>
  );
}
