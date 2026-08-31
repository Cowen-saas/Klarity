import Link from "next/link";
import { IconGraduationCap } from "@/components/icons";

interface NavItem {
  label: string;
  href?: string;
}

/**
 * Barre de navigation publique. "Épreuves" n'a pas encore de section/page
 * cible (la banque d'épreuves n'existe pas encore) -- reste du texte non
 * cliquable plutôt qu'un lien mort, même logique que les items "Bientôt" des
 * sidebars app (EleveShell/ParentShell).
 */
const NAV_ITEMS: NavItem[] = [
  { label: "Fonctionnalités", href: "/#comment-ca-marche" },
  { label: "Épreuves" },
  { label: "Tarifs", href: "/abonnement" },
  // ?from=/parent réutilise le mécanisme déjà présent dans ConnexionForm
  // (roleDepuisFrom) pour ouvrir directement sur l'onglet Parent.
  { label: "Parents", href: "/connexion?from=/parent" },
];

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
          {NAV_ITEMS.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="text-sm font-medium text-texte-muted transition-colors hover:text-texte"
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                aria-disabled="true"
                className="flex cursor-not-allowed items-center gap-1.5 text-sm font-medium text-texte-muted/50"
              >
                {item.label}
                <span className="rounded-full bg-fond px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-texte-muted/70 uppercase">
                  Bientôt
                </span>
              </span>
            )
          )}
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
