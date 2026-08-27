import { IconGraduationCap } from "@/components/icons";

/**
 * Les 3 documents juridiques (docs/legal/*.docx) sont encore des brouillons v1.0
 * non validés par un avocat (mentions "[à compléter]" pour la raison sociale, le
 * RCCM, etc.) -- décision produit : le footer pointe vers le fichier .docx source
 * tel quel plutôt que de republier ce texte provisoire sous forme de page web.
 */
const LEGAL_LINKS = [
  { label: "Mentions légales", href: "/legal/Klarity_Mentions_Legales.docx" },
  { label: "Conditions d'utilisation", href: "/legal/Klarity_CGU.docx" },
  { label: "Politique de confidentialité", href: "/legal/Klarity_Politique_Confidentialite.docx" },
];

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
                  <li key={link.href}>
                    <a
                      href={link.href}
                      download
                      className="text-sm text-texte-muted hover:text-texte"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
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
          <div className="flex items-center gap-2">
            <a href="/legal/Klarity_Mentions_Legales.docx" download className="hover:text-texte">
              Mentions légales
            </a>
            <span aria-hidden="true">|</span>
            <a
              href="/legal/Klarity_Politique_Confidentialite.docx"
              download
              className="hover:text-texte"
            >
              Confidentialité
            </a>
            <span aria-hidden="true">|</span>
            <a href="/legal/Klarity_CGU.docx" download className="hover:text-texte">
              CGU
            </a>
          </div>
          <p>© 2026 Klarity. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
