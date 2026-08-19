/**
 * Shared types for the PaymentProvider abstraction (cahier des charges §5.1).
 * Kept provider-agnostic: MockPaymentProvider and the future
 * CamerPaySandboxProvider/CamerPayLiveProvider (§5.3) all implement PaymentProvider
 * using only these shapes — nothing here should assume CamerPay's actual payload
 * format, which isn't known yet (§5, contexte).
 */

export type MethodePaiement = "MOBILE_MONEY";
export type PayeurRole = "PARENT" | "ELEVE";
export type StatutPaiement = "EN_ATTENTE" | "REUSSI" | "ECHEC" | "REMBOURSE";

export interface Payeur {
  telephone: string;
  role: PayeurRole;
}

export interface PaiementSession {
  sessionId: string;
  /** URL/iframe CamerPay à afficher au payeur, le cas échéant. */
  redirectUrl?: string;
  statut: StatutPaiement;
}

export interface ResultatPaiement {
  /** Correspond à Paiement.idempotencyKey (§4.5) — garantit un crédit unique. */
  idempotencyKey: string;
  statut: StatutPaiement;
  referenceCamerPay: string;
  montant: number;
  devise: string;
}
