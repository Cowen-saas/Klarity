import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "./provider";
import type { MethodePaiement, PaiementSession, Payeur, ResultatPaiement } from "./types";

/**
 * Shape volontairement propre à Klarity (mock) — le format exact du payload
 * CamerPay n'est pas encore connu (§5.3) ; seule l'interface PaymentProvider est
 * fixée à l'avance, pas ce shape interne.
 */
interface MockWebhookPayload {
  sessionId: string;
  statut: "REUSSI" | "ECHEC";
  montant: number;
  devise: string;
}

const MOCK_SIGNING_SECRET = process.env.CAMERPAY_WEBHOOK_SECRET || "mock-dev-secret";

/**
 * Simule un paiement réussi/échoué en local, sans accès CamerPay (§5.2). La
 * vérification de signature HMAC est réellement codée (pas un no-op) mais
 * désactivable via PAYMENT_MOCK_SKIP_SIGNATURE=true pour accélérer les tests
 * manuels locaux — jamais désactivée en sandbox/live (§5.4).
 */
export class MockPaymentProvider implements PaymentProvider {
  async initierPaiement(
    montant: number,
    devise: string,
    _methode: MethodePaiement,
    _payeur: Payeur
  ): Promise<PaiementSession> {
    // Le Mobile Money ne confirme jamais de façon synchrone (§5.5) — le statut
    // réel arrive plus tard via webhook, simulé ici par signerWebhookMock().
    void montant;
    void devise;
    return {
      sessionId: randomUUID(),
      statut: "EN_ATTENTE",
    };
  }

  verifierSignatureWebhook(payloadBrut: unknown, signatureRecue: string): boolean {
    if (process.env.PAYMENT_MOCK_SKIP_SIGNATURE === "true") {
      return true;
    }
    const signatureAttendue = signerPayload(payloadBrut);
    const bufAttendu = Buffer.from(signatureAttendue);
    const bufRecu = Buffer.from(signatureRecue);
    return bufAttendu.length === bufRecu.length && timingSafeEqual(bufAttendu, bufRecu);
  }

  async traiterWebhook(payloadBrut: unknown): Promise<ResultatPaiement> {
    const payload = payloadBrut as MockWebhookPayload;
    return {
      // sessionId sert d'idempotencyKey ici : rejouer le même événement mock
      // doit toujours produire la même clé, condition testée en §5.2.
      idempotencyKey: payload.sessionId,
      statut: payload.statut,
      referenceCamerPay: `MOCK-${payload.sessionId}`,
      montant: payload.montant,
      devise: payload.devise,
    };
  }
}

/** Utilitaire de test : signe un payload mock comme le ferait CamerPay (§5.4). */
export function signerWebhookMock(payload: unknown): string {
  return signerPayload(payload);
}

function signerPayload(payload: unknown): string {
  return createHmac("sha256", MOCK_SIGNING_SECRET).update(JSON.stringify(payload)).digest("hex");
}
