/**
 * Seuils du cycle de rétention des comptes élève (§2.9). Valeurs de départ non
 * figées par le CDC — surchargeables par variable d'environnement, ce qui sert
 * aussi aux tests (réduire temporairement le seuil pour déclencher un job).
 */

function jours(nomEnv: string, defaut: number): number {
  const brut = process.env[nomEnv];
  const n = brut ? Number(brut) : NaN;
  return Number.isFinite(n) && n > 0 ? n : defaut;
}

/** Inactivité au-delà de laquelle un compte ACTIF passe INACTIF_NOTIFIE (§2.9.1). Défaut : 6 mois. */
export const SEUIL_INACTIVITE_JOURS = jours("RETENTION_INACTIVITE_JOURS", 180);

/**
 * Délai de grâce après la notification d'inactivité : si aucune activité ne
 * reprend dans cette fenêtre, le compte est anonymisé (§2.9.1, §2.9.2). Défaut : 60 jours.
 */
export const DELAI_GRACE_JOURS = jours("RETENTION_GRACE_JOURS", 60);

/**
 * Recul, en années scolaires, du job annuel d'archivage des photos de copies
 * (§2.9.3) : on supprime les `photoUploadKeys` des épreuves dont l'année
 * scolaire est antérieure à « année en cours − ANNEE_ARCHIVAGE_RECUL ».
 */
export const ANNEE_ARCHIVAGE_RECUL = jours("RETENTION_ARCHIVAGE_RECUL_ANS", 1);

export function ilYaJours(n: number, depuis: Date = new Date()): Date {
  return new Date(depuis.getTime() - n * 24 * 60 * 60 * 1000);
}

/** Année de début de l'année scolaire en cours (bascule au 1er août). "2026-2027" -> 2026. */
export function anneeScolaireDebutCourante(maintenant: Date = new Date()): number {
  return maintenant.getMonth() >= 7 ? maintenant.getFullYear() : maintenant.getFullYear() - 1;
}
