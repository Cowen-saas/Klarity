import { prisma } from "@/lib/prisma";

/**
 * Tarification Premium (cahier des charges §2.4.1) — calcul **toujours côté
 * serveur**, jamais côté client. Appelé à deux moments : à l'affichage de la
 * page d'abonnement (prix affiché) et au moment du paiement effectif (prix figé
 * dans `Abonnement.prixApplique`, jamais recalculé a posteriori).
 *
 * Les fenêtres promotionnelles (dates + prix réduit) ne sont plus écrites en
 * dur : elles vivent dans la table `PeriodeTarifaire`, gérées par l'admin
 * (`/admin/parametres`). Repli sain : si aucune fenêtre active ne couvre la
 * date, on retombe sur `PRIX_NORMAL_PREMIUM`.
 */

export const PRIX_NORMAL_PREMIUM = 5000;
export const DEVISE_DEFAUT = "XAF";

export interface FenetreTarifaireActive {
  id: string;
  nom: string;
  prix: number;
  dateDebut: Date;
  dateFin: Date;
}

/**
 * Fenêtre tarifaire promotionnelle active couvrant `date`, ou `null` si aucune.
 * En cas de chevauchement de plusieurs fenêtres actives, la **moins chère**
 * l'emporte (meilleur tarif pour l'élève).
 */
export async function periodeTarifaireActive(date: Date = new Date()): Promise<FenetreTarifaireActive | null> {
  const row = await prisma.periodeTarifaire.findFirst({
    where: { actif: true, dateDebut: { lte: date }, dateFin: { gte: date } },
    orderBy: [{ prixApplique: "asc" }, { dateDebut: "desc" }],
    select: { id: true, nom: true, prixApplique: true, dateDebut: true, dateFin: true },
  });
  if (!row) return null;
  return {
    id: row.id,
    nom: row.nom,
    prix: Number(row.prixApplique),
    dateDebut: row.dateDebut,
    dateFin: row.dateFin,
  };
}

export interface TarifPremium {
  prix: number;
  prixNormal: number;
  reduction: number;
  enPromo: boolean;
  /** Nom de la fenêtre promo active (ex. « Promo Noël 2026 »), sinon `null`. */
  nomPeriode: string | null;
}

export async function obtenirTarifPremium(date: Date = new Date()): Promise<TarifPremium> {
  const fenetre = await periodeTarifaireActive(date);
  const prixNormal = PRIX_NORMAL_PREMIUM;
  const prix = fenetre ? fenetre.prix : prixNormal;
  return {
    prix,
    prixNormal,
    reduction: Math.max(0, prixNormal - prix),
    enPromo: prix < prixNormal,
    nomPeriode: fenetre?.nom ?? null,
  };
}
