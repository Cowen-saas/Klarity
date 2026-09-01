import { genererAvatar } from "@/lib/avatar";

interface AvatarProps {
  /** Identifiant unique servant de graine — toujours `Eleve.id`, jamais une valeur devinable/réutilisable. */
  seed: string;
  nom?: string;
  size?: number;
  className?: string;
}

/**
 * Avatar de compte élève (§4.1) — silhouette « profil » générique dont seule
 * la couleur est tirée du seed. Pas de session/état client requis, s'affiche
 * identique côté serveur.
 */
export function Avatar({ seed, nom, size = 40, className = "" }: AvatarProps) {
  const { teinte } = genererAvatar(seed);
  const couleurFond = `hsl(${teinte} 22% 84%)`;
  const couleurSilhouette = `hsl(${teinte} 24% 52%)`;
  const clipId = `avatar-clip-${seed}`;

  return (
    <div
      role="img"
      aria-label={nom ? `Avatar de ${nom}` : "Avatar"}
      className={`shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <circle cx={50} cy={50} r={50} />
          </clipPath>
        </defs>
        <circle cx={50} cy={50} r={50} fill={couleurFond} />
        <g clipPath={`url(#${clipId})`} fill={couleurSilhouette}>
          <circle cx={50} cy={39} r={19} />
          <circle cx={50} cy={92} r={30} />
        </g>
      </svg>
    </div>
  );
}
