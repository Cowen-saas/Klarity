import type { AIProvider } from "./provider";
import { MockAIProvider } from "./mock-provider";
import { ClaudeAIProvider } from "./claude-provider";

export type { AIProvider } from "./provider";
export * from "./types";
export { MODELE_HAIKU, MODELE_SONNET } from "./claude-provider";

/**
 * Sélection au démarrage via AI_MODE = mock | live (§6.2). `live` utilise
 * `ClaudeAIProvider` (Haiku + Sonnet réels, cf. `claude-provider.ts`) — clé
 * `ANTHROPIC_API_KEY` requise. Uniquement un changement de config, aucune
 * réécriture du code appelant grâce à cette interface.
 */
let cachedProvider: AIProvider | undefined;

export function getAIProvider(): AIProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const mode = process.env.AI_MODE ?? "mock";
  switch (mode) {
    case "mock":
      cachedProvider = new MockAIProvider();
      return cachedProvider;
    case "live":
      cachedProvider = new ClaudeAIProvider();
      return cachedProvider;
    default:
      throw new Error(`AI_MODE invalide : "${mode}" (attendu : mock | live)`);
  }
}
