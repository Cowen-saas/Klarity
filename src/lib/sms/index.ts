import type { SmsProvider } from "./provider";
import { MockSmsProvider } from "./mock-provider";

export type { SmsProvider } from "./provider";
export * from "./types";

/**
 * Sélection au démarrage via SMS_MODE = mock | live (§3). Le provider réel
 * (Orange SMS Cameroun ou Africa's Talking) n'est pas encore souscrit — comme
 * pour `AI_MODE` (§6) et `PAYMENT_MODE` (§5), `live` lève une erreur explicite
 * tant que la classe correspondante n'existe pas, et seul `mock` est
 * fonctionnel. Y basculer plus tard = un changement de config + une nouvelle
 * classe, aucune réécriture du code appelant.
 */
let cachedProvider: SmsProvider | undefined;

export function getSmsProvider(): SmsProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const mode = process.env.SMS_MODE ?? "mock";
  switch (mode) {
    case "mock":
      cachedProvider = new MockSmsProvider();
      return cachedProvider;
    case "live":
      throw new Error(
        "Aucun SmsProvider live n'est implémenté — fournisseur SMS non souscrit " +
          "(Orange SMS Cameroun ou Africa's Talking, cf. cahier des charges §3). Utilisez SMS_MODE=mock en attendant."
      );
    default:
      throw new Error(`SMS_MODE invalide : "${mode}" (attendu : mock | live)`);
  }
}
