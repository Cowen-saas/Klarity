import type { MethodePaiement, PaiementSession, Payeur, ResultatPaiement } from "./types";

/**
 * Interface PaymentProvider (cahier des charges §5.1) — toute la logique métier
 * (création d'abonnement, mise à jour de statut, crédit du compte) s'appuie
 * exclusivement sur cette interface, jamais sur un appel direct au SDK/API
 * CamerPay. Isole 100% du code applicatif d'un changement d'agrégateur ou d'un
 * passage sandbox -> live (§5.3).
 */
export interface PaymentProvider {
  initierPaiement(
    montant: number,
    devise: string,
    methode: MethodePaiement,
    payeur: Payeur
  ): Promise<PaiementSession>;

  /** Aucun payload webhook non signé n'est traité, même en cas de doute (§5.4, §7). */
  verifierSignatureWebhook(payloadBrut: unknown, signatureRecue: string): boolean;

  /** Doit être idempotent — un même événement webhook rejoué ne crédite qu'une fois (§5.4, §8). */
  traiterWebhook(payloadBrut: unknown): Promise<ResultatPaiement>;
}
