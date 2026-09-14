import type { SmsProvider } from "./provider";
import { MockSmsProvider } from "./mock-provider";
import { SmsProProvider } from "./smspro-provider";

export type { SmsProvider } from "./provider";
export * from "./types";

/**
 * Sélection au démarrage via SMS_MODE = mock | smspro (§3). SmsPro remplace
 * Africa's Talking (cf. `docs/PROGRESS.md`) — couvre nativement MTN, Orange et
 * Camtel, propose un paiement local en Mobile Money, et évite le souci de
 * livraison MTN identifié par ailleurs. `mock` reste le défaut tant que le
 * passage en production n'est pas explicitement confirmé — y basculer = un
 * changement de config, aucune réécriture du code appelant.
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
    case "smspro":
      cachedProvider = new SmsProProvider();
      return cachedProvider;
    default:
      throw new Error(`SMS_MODE invalide : "${mode}" (attendu : mock | smspro)`);
  }
}
