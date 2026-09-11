import type { SmsProvider } from "./provider";
import { MockSmsProvider } from "./mock-provider";
import { AfricasTalkingProvider } from "./africastalking-provider";

export type { SmsProvider } from "./provider";
export * from "./types";

/**
 * Sélection au démarrage via SMS_MODE = mock | africastalking (§3). Africa's
 * Talking remplace Orange SMS Cameroun (jamais implémenté ni souscrit — sa
 * propre FAQ documentait un problème de livraison vers MTN ; Africa's Talking
 * couvre nativement MTN et Orange au Cameroun). `mock` reste le défaut tant
 * que le passage en production n'est pas explicitement confirmé — y basculer
 * = un changement de config, aucune réécriture du code appelant.
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
    case "africastalking":
      cachedProvider = new AfricasTalkingProvider();
      return cachedProvider;
    default:
      throw new Error(`SMS_MODE invalide : "${mode}" (attendu : mock | africastalking)`);
  }
}
