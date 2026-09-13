import Link from "next/link";
import { IconGraduationCap } from "@/components/icons";

/**
 * Les 3 documents juridiques (docs/legal/*.docx) sont finalisés et validés
 * (13 septembre 2026, §46 de docs/PROGRESS.md) — leur contenu est publié sous
 * forme de pages web dédiées (`/mentions-legales`, `/cgu`, `/confidentialite`,
 * cf. `src/content/legal/`), pas en téléchargement direct du `.docx` source :
 * les fichiers originaux restent uniquement dans `docs/legal/` comme
 * référence/archive, jamais copiés dans `public/`.
 */
const LEGAL_LINKS = [
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Conditions d'utilisation", href: "/cgu" },
  { label: "Politique de confidentialité", href: "/confidentialite" },
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
                    <Link href={link.href} className="text-sm text-texte-muted hover:text-texte">
                      {link.label}
                    </Link>
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
            <Link href="/mentions-legales" className="hover:text-texte">
              Mentions légales
            </Link>
            <span aria-hidden="true">|</span>
            <Link href="/confidentialite" className="hover:text-texte">
              Confidentialité
            </Link>
            <span aria-hidden="true">|</span>
            <Link href="/cgu" className="hover:text-texte">
              CGU
            </Link>
          </div>
          <p>© 2026 Klarity. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
