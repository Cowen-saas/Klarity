import type { ModeleIA } from "@prisma/client";

/**
 * Tarifs placeholder pour UsageIA.coutEstime (§6.1, cost-control non-négociable) —
 * $/1M tokens, Claude Haiku 4.5 (`claude-haiku-4-5`). À remplacer par la
 * facturation réelle du provider une fois `AI_MODE=live` (Phase 3, §6.5) ;
 * seul le mode chat (Haiku) est utilisé avant cette phase.
 */
const PRIX_PAR_MILLION_TOKENS: Record<ModeleIA, { input: number; output: number }> = {
  HAIKU: { input: 1.0, output: 5.0 },
  SONNET: { input: 3.0, output: 15.0 },
};

export function estimerCoutIA(modele: ModeleIA, tokensInput: number, tokensOutput: number): number {
  const prix = PRIX_PAR_MILLION_TOKENS[modele];
  return (tokensInput / 1_000_000) * prix.input + (tokensOutput / 1_000_000) * prix.output;
}
