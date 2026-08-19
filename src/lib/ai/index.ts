import type { AIProvider } from "./provider";
import { MockAIProvider } from "./mock-provider";

export type { AIProvider } from "./provider";
export * from "./types";

/**
 * Sélection au démarrage via AI_MODE = mock | live (§6.2). ClaudeAIProvider
 * (Haiku + Sonnet réels) arrive en Phase 3, dès obtention de la clé API
 * Anthropic (§6.5) — uniquement un changement de config + une nouvelle classe,
 * aucune réécriture du code appelant grâce à cette interface.
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
      throw new Error(
        "ClaudeAIProvider n'est pas encore implémenté (Phase 3, cf. cahier des charges §6.5) — " +
          "clé API Anthropic requise. Utilisez AI_MODE=mock en attendant."
      );
    default:
      throw new Error(`AI_MODE invalide : "${mode}" (attendu : mock | live)`);
  }
}
