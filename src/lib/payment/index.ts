import type { PaymentProvider } from "./provider";
import { MockPaymentProvider } from "./mock-provider";

export type { PaymentProvider } from "./provider";
export * from "./types";

/**
 * Sélection au démarrage via PAYMENT_MODE = mock | sandbox | live (§5.1).
 * CamerPaySandboxProvider et CamerPayLiveProvider (§5.3) partagent la même
 * interface — seules l'URL de base et les clés changent entre les deux.
 */
let cachedProvider: PaymentProvider | undefined;

export function getPaymentProvider(): PaymentProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const mode = process.env.PAYMENT_MODE ?? "mock";
  switch (mode) {
    case "mock":
      cachedProvider = new MockPaymentProvider();
      return cachedProvider;
    case "sandbox":
    case "live":
      throw new Error(
        `CamerPay${mode === "live" ? "Live" : "Sandbox"}Provider n'est pas encore implémenté ` +
          "(Phase 4, cf. cahier des charges §5.3) — accès CamerPay requis. Utilisez PAYMENT_MODE=mock en attendant."
      );
    default:
      throw new Error(`PAYMENT_MODE invalide : "${mode}" (attendu : mock | sandbox | live)`);
  }
}
