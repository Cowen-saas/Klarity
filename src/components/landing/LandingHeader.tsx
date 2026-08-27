import Link from "next/link";
import { IconGraduationCap } from "@/components/icons";

const NAV_LABELS = ["Fonctionnalités", "Épreuves", "Tarifs", "Parents"];

/**
 * Barre de navigation publique. Les libellés centraux (Fonctionnalités, Épreuves,
 * Tarifs, Parents) n'ont pas encore de section/page cible dans le produit -- ils
 * restent du texte non cliquable plutôt que des liens morts.
 */
export function LandingHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <IconGraduationCap className="h-5 w-5" weight="fill" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold text-texte">Klarity</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LABELS.map((label) => (
            <span key={label} className="text-sm font-medium text-texte-muted">
              {label}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link href="/connexion" className="text-sm font-semibold text-texte">
            Connexion
          </Link>
          <Link
            href="/inscription"
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Créer un compte
          </Link>
        </div>
      </div>
    </header>
  );
}
