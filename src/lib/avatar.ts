/**
 * Avatar de compte élève — généré déterministiquement à partir de l'`id`
 * unique de l'`Eleve` (cuid), jamais stocké : le même id produit toujours le
 * même avatar, et deux élèves différents ont toujours un id différent, donc
 * un avatar visuellement différent — sans dépendance à un service externe
 * (pas d'appel réseau, pas d'image hébergée à gérer) et sans migration de
 * schéma. Motif "identicon" : grille 5×5 symétrique + teinte, dérivés d'un
 * hash du seed.
 */

export interface MotifAvatar {
  teinte: number; // 0-359
  cellules: boolean[][]; // 5 lignes x 5 colonnes, symétrique horizontalement
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

const LIGNES = 5;
const COLONNES_UTILES = 3; // colonne centrale + 2 colonnes miroitées vers les bords

export function genererAvatar(seed: string): MotifAvatar {
  const aleatoire = mulberry32(hashSeed(seed));
  const teinte = Math.floor(aleatoire() * 360);

  const cellules: boolean[][] = [];
  for (let ligne = 0; ligne < LIGNES; ligne++) {
    const moitie: boolean[] = [];
    for (let colonne = 0; colonne < COLONNES_UTILES; colonne++) {
      moitie.push(aleatoire() > 0.55);
    }
    // [c0, c1, c2(centre), c1, c0] — grille miroitée façon identicon.
    cellules.push([...moitie, moitie[1], moitie[0]]);
  }

  return { teinte, cellules };
}
