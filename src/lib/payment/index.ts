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

/**
 * Indice affiché en dev (jamais en production) pour tester le paiement sans
 * deviner une convention — **dépend du provider réellement actif**, pas d'un
 * seul `NODE_ENV`, pour ne jamais montrer la convention du mock
 * (`MockPaymentProvider` : "un numéro terminé par 0 échoue") alors que
 * NotchPay sandbox tourne réellement, qui a sa propre liste fermée de
 * numéros de test (cf. `NotchPayProvider` — tout autre numéro est rejeté
 * avec un 422 "Invalid test phone number"). Rien à afficher en NotchPay live
 * : un vrai numéro Mobile Money est alors attendu, pas de convention de test.
 */
export function indiceDevPaiement(): string | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  const mode = process.env.PAYMENT_MODE ?? "mock";
  if (mode === "mock") {
    return "Mode simulation : un numéro terminé par 0 échoue, tout autre numéro réussit.";
  }
  if (mode === "notchpay" && (process.env.NOTCHPAY_ENV ?? "sandbox") === "sandbox") {
    return "Sandbox NotchPay : utilise l'un des numéros de test +237670000000 (succès), " +
      "+237670000001 (fonds insuffisants), +237670000002 (échec), +237670000003 (timeout) ou " +
      "+237670000004 (annulé) — tout autre numéro est refusé par NotchPay.";
  }
  return undefined;
}
