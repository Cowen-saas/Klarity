/**
 * Avatar de compte élève — généré déterministiquement à partir de l'`id`
 * unique de l'`Eleve` (cuid), jamais stocké : le même id produit toujours le
 * même avatar, et deux élèves différents ont un id différent donc une couleur
 * différente — sans dépendance à un service externe (pas d'appel réseau, pas
 * d'image hébergée à gérer) et sans migration de schéma.
 *
 * Le motif est une silhouette générique « profil » (tête + épaules dans un
 * cercle) identique pour tout le monde ; seule la teinte HSL est tirée
 * aléatoirement du seed — saturation et luminosité restent fixes pour que
 * chaque avatar garde le même style, seule la couleur change.
 */

export interface CouleurAvatar {
  /** Teinte HSL, 0-359 — dérivée du seed. */
  teinte: number;
}

function hashSeed(seed: string): number {
  // FNV-1a 32 bits — simple, déterministe, suffisant pour dériver un PRNG.
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(graine: number): () => number {
  let etat = graine;
  return function next() {
    etat = (etat + 0x6d2b79f5) | 0;
    let t = Math.imul(etat ^ (etat >>> 15), 1 | etat);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function genererAvatar(seed: string): CouleurAvatar {
  const aleatoire = mulberry32(hashSeed(seed));
  return { teinte: Math.floor(aleatoire() * 360) };
}
