/**
 * determinerPeriodeTarifaire (cahier des charges §2.4.1) — calcul toujours
 * côté serveur, jamais côté client. Appelée à deux moments distincts avec deux
 * conséquences différentes : à l'affichage de la page de paiement (prix
 * affiché) et au moment du paiement effectif (prix figé dans
 * Abonnement.prixApplique, jamais recalculé a posteriori).
 */

export type PeriodeTarifaire = "NOEL" | "PAQUES" | "NORMALE";

const MOIS_NOEL = [11, 0, 1]; // décembre, janvier, février (Date#getMonth() est 0-indexé)
const MOIS_PAQUES = [3, 4, 5]; // avril, mai, juin

export const PRIX_NORMAL_PREMIUM = 5000;
export const PRIX_PROMO_PREMIUM = 3000;
export const DEVISE_DEFAUT = "XAF";

export function determinerPeriodeTarifaire(date: Date): PeriodeTarifaire {
  const mois = date.getMonth();
  if (MOIS_NOEL.includes(mois)) return "NOEL";
  if (MOIS_PAQUES.includes(mois)) return "PAQUES";
  return "NORMALE";
}

export interface TarifPremium {
  periode: PeriodeTarifaire;
  prix: number;
  prixNormal: number;
  reduction: number;
}

export function obtenirTarifPremium(date: Date = new Date()): TarifPremium {
  const periode = determinerPeriodeTarifaire(date);
  const prix = periode === "NORMALE" ? PRIX_NORMAL_PREMIUM : PRIX_PROMO_PREMIUM;
  return { periode, prix, prixNormal: PRIX_NORMAL_PREMIUM, reduction: PRIX_NORMAL_PREMIUM - prix };
}
