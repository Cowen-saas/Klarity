import type { StorageProvider } from "./provider";
import { MockStorageProvider } from "./mock-provider";

export type { StorageProvider } from "./provider";
export * from "./types";

/**
 * Sélection au démarrage via STORAGE_MODE = mock | r2 (§3, §4.2). Comme
 * AI_MODE / PAYMENT_MODE / SMS_MODE, `r2` lève une erreur explicite tant que la
 * classe `R2StorageProvider` n'existe pas (clés Cloudflare R2 pas encore
 * obtenues) — seul `mock` est fonctionnel. Basculer plus tard = un changement
 * de config + une nouvelle classe, aucune réécriture des appelants.
 */
let cachedProvider: StorageProvider | undefined;

export function getStorageProvider(): StorageProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const mode = process.env.STORAGE_MODE ?? "mock";
  switch (mode) {
    case "mock":
      cachedProvider = new MockStorageProvider();
      return cachedProvider;
    case "r2":
      throw new Error(
        "R2StorageProvider n'est pas encore implémenté — clés Cloudflare R2 pas encore obtenues " +
          "(cf. cahier des charges §3). Utilisez STORAGE_MODE=mock en attendant."
      );
    default:
      throw new Error(`STORAGE_MODE invalide : "${mode}" (attendu : mock | r2)`);
  }
}
