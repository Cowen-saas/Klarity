import { IconWarning } from "@/components/icons";

/**
 * Bandeau d'avertissement affiché sur les écrans financiers admin tant que
 * CamerPay n'est pas en `PAYMENT_MODE=live` (§5.2, §5.3). Empêche qu'un futur
 * lecteur — Claude ou un collaborateur — prenne ces chiffres pour du vrai
 * chiffre d'affaires. Les paiements en mode mock/sandbox sont produits par le
 * simulateur de webhook (`worker`), pas par de vrais mouvements Mobile Money.
 */
export function BandeauModeTest({ mode, sujet }: { mode: string; sujet: string }) {
  return (
    <div className="mt-6 flex items-start gap-3 rounded-xl border-2 border-accent bg-accent-light px-4 py-3">
      <IconWarning className="mt-0.5 h-5 w-5 shrink-0 text-accent" weight="fill" aria-hidden="true" />
      <p className="text-sm text-texte">
        <strong>Données de test — {sujet} non réels.</strong> CamerPay tourne en{" "}
        <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">PAYMENT_MODE={mode}</code> : ces
        transactions sont générées par le simulateur de webhook, pas par de vrais paiements Mobile Money. Ne pas
        confondre avec du chiffre d&apos;affaires réel.
      </p>
    </div>
  );
}
