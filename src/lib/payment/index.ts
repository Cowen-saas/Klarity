import type { PaymentProvider } from "./provider";
import { MockPaymentProvider } from "./mock-provider";
import { NotchPayProvider } from "./notchpay-provider";

export type { PaymentProvider } from "./provider";
export * from "./types";

/**
 * Sélection au démarrage via PAYMENT_MODE = mock | notchpay (§5.1).
 * Pas de mode "sandbox"/"live" séparé côté code : NotchPay n'expose qu'une
 * seule URL d'API pour les deux — c'est le préfixe de NOTCHPAY_PUBLIC_KEY
 * (`pk_test_…` vs `pk_live_…`) qui distingue un compte sandbox d'un compte
 * live, jamais PAYMENT_MODE. Voir `paiementsSontReels()` ci-dessous.
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
 * Vrai uniquement si des paiements NotchPay **réels** (clé publique live) sont
 * actifs — sert à décider si le bandeau "données de test" (`BandeauModeTest`)
 * doit s'afficher sur les écrans financiers admin (§2.3, §2.4). `PAYMENT_MODE`
 * seul ne suffit pas : `notchpay` peut tourner avec une clé `pk_test_…`
 * (sandbox) tout autant qu'avec une clé `pk_live_…`.
 */
export function paiementsSontReels(): boolean {
  if ((process.env.PAYMENT_MODE ?? "mock") !== "notchpay") return false;
  return (process.env.NOTCHPAY_PUBLIC_KEY ?? "").startsWith("pk_live_");
}
