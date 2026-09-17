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
  /** Id de transaction du provider actif (mock ou NotchPay). Correspond à Paiement.referenceTransaction. */
  referenceTransaction: string;
  montant: number;
  devise: string;
}

/**
 * Levée quand le provider de paiement **refuse la requête** (numéro invalide,
 * saisie rejetée par l'opérateur, etc.) — une erreur métier dont la cause est
 * connue et explicable à l'utilisateur, distincte d'une panne technique
 * (réseau, provider indisponible, 5xx). `message` est déjà formulé pour
 * l'utilisateur final (français, sans détail d'implémentation) ;
 * `detailProvider` garde la réponse brute du provider pour les logs serveur
 * et l'indice dev, jamais affiché tel quel côté client en production.
 */
export class PaiementRefuseError extends Error {
  readonly detailProvider: string;

  constructor(message: string, detailProvider: string) {
    super(message);
    this.name = "PaiementRefuseError";
    this.detailProvider = detailProvider;
  }
}
