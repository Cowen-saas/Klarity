import { IconGraduationCap } from "@/components/icons";

/**
 * Les 3 documents juridiques (docs/legal/*.docx, copiés dans public/legal/) sont
 * encore des brouillons v1.0 non validés par un avocat (mentions "[à compléter]"
 * pour la raison sociale, le RCCM, etc.).
 *
 * **État temporaire (13 septembre 2026)** : le site étant sur le point d'être
 * référencé publiquement pour la première fois (dossier NotchPay), les liens ont
 * été **désactivés** — les libellés restent visibles pour ne pas casser la mise
 * en page, mais ne sont plus cliquables et portent la mention « Bientôt
 * disponible ». À **réactiver** (remettre les `<a href>` — l'historique git de ce
 * fichier contient la version cliquable) une fois les documents finalisés et
 * validés par un avocat. Voir `docs/PROGRESS.md` §44.
 */
const LEGAL_LINKS = [
  { label: "Mentions légales", href: "/legal/Klarity_Mentions_Legales.docx" },
  { label: "Conditions d'utilisation", href: "/legal/Klarity_CGU.docx" },
  { label: "Politique de confidentialité", href: "/legal/Klarity_Politique_Confidentialite.docx" },
];

/** Libellé légal visible mais non cliquable — cf. commentaire ci-dessus. */
const LEGAL_DESACTIVE_TITRE = "Bientôt disponible";
const legalDesactiveClasses = "cursor-not-allowed text-texte-muted/60";

export function LandingFooter() {
  return (
    <footer className="bg-primary-light">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                <IconGraduationCap className="h-5 w-5" weight="fill" aria-hidden="true" />
              </span>
              <span className="text-lg font-bold text-texte">Klarity</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-texte">
              Comprends tes lacunes. Progresse chaque jour.
            </p>
          </div>

          <div className="flex gap-16">
            <div>
              <p className="text-sm font-bold text-texte">Légal</p>
              <ul className="mt-3 space-y-2">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.href} title={LEGAL_DESACTIVE_TITRE}>
                    <span className={`text-sm ${legalDesactiveClasses}`}>{link.label}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-texte-muted/60">{LEGAL_DESACTIVE_TITRE}</p>
            </div>
            <div>
              <p className="text-sm font-bold text-texte">Contact</p>
              <ul className="mt-3 space-y-2 text-sm text-texte-muted">
                <li>
                  <a href="mailto:cowen.noumbou@gmail.com" className="hover:text-texte">
                    cowen.noumbou@gmail.com
                  </a>
                </li>
                <li>
                  <a href="tel:+237681741973" className="hover:text-texte">
                    +237 681 74 19 73
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-primary/10">
        <div className="mx-auto flex max-w-6xl flex-col-reverse items-center justify-between gap-3 px-6 py-5 text-xs text-texte-muted sm:flex-row sm:px-8">
          <div className="flex items-center gap-2" title={LEGAL_DESACTIVE_TITRE}>
            <span className={legalDesactiveClasses}>Mentions légales</span>
            <span aria-hidden="true">|</span>
            <span className={legalDesactiveClasses}>Confidentialité</span>
            <span aria-hidden="true">|</span>
            <span className={legalDesactiveClasses}>CGU</span>
          </div>
          <p>© 2026 Klarity. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
