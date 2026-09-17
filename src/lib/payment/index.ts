import type { PaymentProvider } from "./provider";
import { MockPaymentProvider } from "./mock-provider";
import { NotchPayProvider } from "./notchpay-provider";

export type { PaymentProvider } from "./provider";
export * from "./types";

/**
 * Sélection au démarrage via PAYMENT_MODE = mock | notchpay (§5.1).
 * Sandbox vs live (§5, compte live obtenu le 17 septembre 2026) est un axe
 * indépendant, piloté par `NOTCHPAY_ENV` (sandbox | live, défaut sandbox) —
 * cf. `NotchPayProvider` — pas une valeur de `PAYMENT_MODE`. Voir
 * `paiementsSontReels()` ci-dessous.
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
    case "notchpay":
      cachedProvider = new NotchPayProvider();
      return cachedProvider;
    default:
      throw new Error(`PAYMENT_MODE invalide : "${mode}" (attendu : mock | notchpay)`);
  }
}

/**
 * Vrai uniquement si des paiements NotchPay **réels** (NOTCHPAY_ENV=live) sont
 * actifs — sert à décider si le bandeau "données de test" (`BandeauModeTest`)
 * doit s'afficher sur les écrans financiers admin (§2.3, §2.4). `PAYMENT_MODE`
 * seul ne suffit pas : `notchpay` tourne aussi bien en sandbox qu'en live,
 * cf. `NotchPayProvider`/`NOTCHPAY_ENV`.
 */
export function paiementsSontReels(): boolean {
  if ((process.env.PAYMENT_MODE ?? "mock") !== "notchpay") return false;
  return (process.env.NOTCHPAY_ENV ?? "sandbox") === "live";
}
