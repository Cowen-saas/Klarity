"use client";

import { useState } from "react";
import Link from "next/link";
import { IconGraduationCap, IconMenu, IconClose } from "@/components/icons";

interface NavItem {
  label: string;
  href?: string;
}

/**
 * Barre de navigation publique. "Épreuves" mène à un vrai accès à la banque :
 * `/connexion?from=/eleve/epreuves`. La banque d'épreuves étant réservée à
 * l'élève, cet écran de connexion **retire** l'option Parent (pas seulement
 * grisée) et centre l'unique option "Élève" — cf. `eleveUniquement` dans
 * `ConnexionForm`. Après connexion, `EleveLoginForm` honore `from` (préfixe
 * `/eleve`) et renvoie sur la banque. Pas d'ancre morte vers une section.
 */
const NAV_ITEMS: NavItem[] = [
  { label: "Fonctionnalités", href: "/#comment-ca-marche" },
  { label: "Épreuves", href: "/connexion?from=/eleve/epreuves" },
  { label: "Tarifs", href: "/abonnement" },
  // role=PARENT ouvre directement sur l'onglet Parent et le verrouille
  // (l'onglet Élève est grisé, non cliquable) — spécifique à ce point
  // d'entrée ; from=/parent reste le mécanisme de redirection post-connexion.
  { label: "Parents", href: "/connexion?from=/parent&role=PARENT" },
];

export function LandingHeader() {
  const [menuOuvert, setMenuOuvert] = useState(false);

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2" onClick={() => setMenuOuvert(false)}>
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

        <div className="hidden items-center gap-4 md:flex">
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

        <button
          type="button"
          onClick={() => setMenuOuvert((v) => !v)}
          aria-expanded={menuOuvert}
          aria-controls="menu-mobile-landing"
          aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-texte transition-colors hover:bg-fond md:hidden"
        >
          {menuOuvert ? (
            <IconClose className="h-6 w-6" aria-hidden="true" />
          ) : (
            <IconMenu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </div>

      {menuOuvert && (
        <nav id="menu-mobile-landing" className="border-t border-border px-6 py-4 md:hidden">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                {item.href ? (
                  <Link
                    href={item.href}
                    onClick={() => setMenuOuvert(false)}
                    className="block rounded-lg px-3 py-3 text-base font-medium text-texte transition-colors hover:bg-fond"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-3 text-base font-medium text-texte-muted/50"
                  >
                    {item.label}
                    <span className="rounded-full bg-fond px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-texte-muted/70 uppercase">
                      Bientôt
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-3 border-t border-border pt-4">
            <Link
              href="/connexion"
              onClick={() => setMenuOuvert(false)}
              className="rounded-xl border-2 border-border py-3 text-center text-sm font-semibold text-texte transition-colors hover:border-primary/40"
            >
              Connexion
            </Link>
            <Link
              href="/inscription"
              onClick={() => setMenuOuvert(false)}
              className="rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Créer un compte
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
