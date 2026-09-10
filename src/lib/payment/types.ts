/**
 * Shared types for the PaymentProvider abstraction (cahier des charges §5.1).
 * Kept provider-agnostic: MockPaymentProvider and NotchPayProvider (§5.3) all
 * implement PaymentProvider using only these shapes.
 */

export type MethodePaiement = "MOBILE_MONEY";
export type PayeurRole = "PARENT" | "ELEVE";
export type StatutPaiement = "EN_ATTENTE" | "REUSSI" | "ECHEC" | "REMBOURSE";
/** Opérateur Mobile Money — détermine le canal NotchPay (`cm.orange`/`cm.mtn`). */
export type OperateurMobileMoney = "ORANGE" | "MTN";

export interface Payeur {
  telephone: string;
  role: PayeurRole;
  /** Requis par NotchPayProvider pour sélectionner le canal ; ignoré par MockPaymentProvider. */
  operateur?: OperateurMobileMoney;
}

export interface PaiementSession {
  sessionId: string;
  /** URL/iframe de repli à afficher au payeur, le cas échéant (NotchPay : `authorization_url`). */
  redirectUrl?: string;
  statut: StatutPaiement;
}

export interface ResultatPaiement {
  /** Correspond à Paiement.idempotencyKey (§4.5) — garantit un crédit unique. */
  idempotencyKey: string;
  statut: StatutPaiement;
  /** Nom de champ hérité (colonne `Paiement.referenceCamerPay`) — contient en réalité l'id de transaction du provider actif (mock ou NotchPay), jamais spécifique à CamerPay. */
  referenceCamerPay: string;
  montant: number;
  devise: string;
}
