import { IconWarning } from "@/components/icons";

/**
 * Bandeau d'avertissement affiché sur les écrans financiers admin tant que
 * `paiementsSontReels()` (`src/lib/payment/index.ts`) est faux — càd hors
 * PAYMENT_MODE=notchpay avec NOTCHPAY_ENV=live (§5.2, §5.3). Empêche qu'un
 * futur lecteur — Claude ou un collaborateur — prenne ces chiffres pour du vrai
 * chiffre d'affaires. En mock, les transactions viennent du simulateur de
 * webhook (`worker`) ; en NotchPay sandbox (NOTCHPAY_ENV=sandbox), ce sont de
 * vrais appels API mais avec de l'argent factice.
 */
export function BandeauModeTest({ mode, sujet }: { mode: string; sujet: string }) {
  return (
    <div className="mt-6 flex items-start gap-3 rounded-xl border-2 border-accent bg-accent-light px-4 py-3">
      <IconWarning className="mt-0.5 h-5 w-5 shrink-0 text-accent" weight="fill" aria-hidden="true" />
      <p className="text-sm text-texte">
        <strong>Données de test — {sujet} non réels.</strong> Le paiement Mobile Money tourne en{" "}
        <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">PAYMENT_MODE={mode}</code> : ces
        transactions ne sont pas de vrais mouvements d&apos;argent. Ne pas confondre avec du chiffre d&apos;affaires
        réel.
      </p>
    </div>
  );
}
