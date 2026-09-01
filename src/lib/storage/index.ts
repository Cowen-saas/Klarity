import type { StorageProvider } from "./provider";
import { MockStorageProvider } from "./mock-provider";
import { R2StorageProvider } from "./r2-provider";

export type { StorageProvider } from "./provider";
export * from "./types";

/**
 * Sélection au démarrage via STORAGE_MODE = mock | r2 (§3, §4.2). Comme
 * AI_MODE / PAYMENT_MODE / SMS_MODE, la bascule mock → réel est un simple
 * changement de config : `mock` écrit dans `.storage-mock/`, `r2` parle à
 * Cloudflare R2 (clés `R2_*` dans `.env`). Aucune réécriture des appelants.
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
      cachedProvider = new R2StorageProvider();
      return cachedProvider;
    default:
      throw new Error(`STORAGE_MODE invalide : "${mode}" (attendu : mock | r2)`);
  }
}
