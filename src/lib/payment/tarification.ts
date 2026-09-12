import { prisma } from "@/lib/prisma";

/**
 * Tarification Premium (cahier des charges §2.4.1) — calcul **toujours côté
 * serveur**, jamais côté client. Appelé à deux moments : à l'affichage de la
 * page d'abonnement (prix affiché) et au moment du paiement effectif (prix figé
 * dans `Abonnement.prixApplique`, jamais recalculé a posteriori).
 *
 * Les fenêtres promotionnelles (dates + prix réduit) ne sont plus écrites en
 * dur : elles vivent dans la table `PeriodeTarifaire`, gérées par l'admin
 * (`/admin/parametres`). Le prix normal (hors promo) suit désormais le même
 * principe : configurable via `ParametrePlateforme` (clé `PRIX_NORMAL_PREMIUM`),
 * éditable sur le même écran. Repli sain dans les deux cas : aucune fenêtre
 * active ⇒ prix normal ; aucune ligne `ParametrePlateforme` pour cette clé
 * (jamais modifiée par un admin) ⇒ `PRIX_NORMAL_PREMIUM_DEFAUT`.
 */

/** Repli si l'admin n'a jamais modifié le prix normal depuis `/admin/parametres`. */
export const PRIX_NORMAL_PREMIUM_DEFAUT = 5000;
export const DEVISE_DEFAUT = "XAF";

/** Clé `ParametrePlateforme` portant le prix Premium normal (hors promo). */
export const CLE_PRIX_NORMAL_PREMIUM = "PRIX_NORMAL_PREMIUM";

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

/**
 * Prix Premium normal (hors promo), tel que configuré par l'admin. `null` si
 * jamais modifié — le repli sur `PRIX_NORMAL_PREMIUM_DEFAUT` reste explicite
 * chez l'appelant plutôt que masqué ici, pour que `/admin/parametres` puisse
 * distinguer « jamais configuré » de « configuré à une valeur ».
 */
export async function prixNormalPremiumConfigure(): Promise<number | null> {
  const param = await prisma.parametrePlateforme.findUnique({
    where: { cle: CLE_PRIX_NORMAL_PREMIUM },
    select: { valeur: true },
  });
  if (!param) return null;
  const valeur = Number(param.valeur);
  return Number.isFinite(valeur) && valeur > 0 ? valeur : null;
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
  const [fenetre, prixConfigure] = await Promise.all([periodeTarifaireActive(date), prixNormalPremiumConfigure()]);
  const prixNormal = prixConfigure ?? PRIX_NORMAL_PREMIUM_DEFAUT;
  const prix = fenetre ? fenetre.prix : prixNormal;
  return {
    prix,
    prixNormal,
    reduction: Math.max(0, prixNormal - prix),
    enPromo: prix < prixNormal,
    nomPeriode: fenetre?.nom ?? null,
  };
}
