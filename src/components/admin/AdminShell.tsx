"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  IconChart,
  IconUsers,
  IconUser,
  IconDocument,
  IconPencil,
  IconFlag,
  IconCalendar,
  IconSparkles,
  IconShield,
  IconCreditCard,
  IconCoins,
  IconSettings,
  IconMenu,
  IconClose,
} from "@/components/icons";
import { KlarityLogo } from "@/components/ui/KlarityLogo";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  disabled?: boolean;
  badge?: number;
}

function buildNavItems(correctionsSignaleesCount: number): NavItem[] {
  return [
    { href: "/admin", label: "Vue d'ensemble", icon: IconChart },
    { href: "/admin/utilisateurs", label: "Utilisateurs", icon: IconUsers },
    { href: "/admin/eleves", label: "Élèves", icon: IconUser },
    { href: "/admin/parents", label: "Parents", icon: IconUsers },
    { href: "/admin/epreuves", label: "Épreuves", icon: IconDocument },
    { href: "/admin/exemples-corriges", label: "Exemples corrigés", icon: IconPencil },
    {
      href: "/admin/corrections-signalees",
      label: "Corrections signalées",
      icon: IconFlag,
      badge: correctionsSignaleesCount,
    },
    { href: "/admin/dates-examens", label: "Dates d'examens", icon: IconCalendar },
    { href: "/admin/usage-ia", label: "Usage IA", icon: IconSparkles },
    { href: "/admin/securite", label: "Sécurité", icon: IconShield },
    { href: "/admin/paiements", label: "Paiements", icon: IconCreditCard },
    { href: "/admin/revenus", label: "Revenus", icon: IconCoins },
    { href: "/admin/parametres", label: "Paramètres", icon: IconSettings },
  ];
}

/**
 * 13 destinations — bien au-delà de ce qu'une bottom-nav peut porter
 * lisiblement sur mobile (contrairement à Eleve/ParentShell, 8 items,
 * cf. docs/PROGRESS.md §78-79). Mobile ici reprend donc le patron
 * hamburger + tiroir déroulant de `LandingHeader.tsx` (§77) plutôt qu'une
 * bottom-nav à colonnes de ~27px illisibles — pas de bottom-nav du tout
 * n'était pas une option : sans elle, aucune navigation mobile n'existait.
 */
export function AdminShell({ children, correctionsSignaleesCount }: { children: ReactNode; correctionsSignaleesCount: number }) {
  const pathname = usePathname();
  const navItems = buildNavItems(correctionsSignaleesCount);
  const [menuOuvert, setMenuOuvert] = useState(false);

  return (
    <div className="min-h-screen bg-fond md:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-[#0e1512] px-4 py-6 text-white md:flex">
        <KlarityLogo wordmark="Klarity Admin" />
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
      </aside>

      <header className="flex items-center justify-between border-b border-border bg-[#0e1512] px-4 py-3 text-white md:hidden">
        <KlarityLogo wordmark="Klarity Admin" />
        <button
          type="button"
          onClick={() => setMenuOuvert((v) => !v)}
          aria-expanded={menuOuvert}
          aria-controls="menu-mobile-admin"
          aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10"
        >
          {menuOuvert ? <IconClose className="h-6 w-6" aria-hidden="true" /> : <IconMenu className="h-6 w-6" aria-hidden="true" />}
        </button>
      </header>

      {menuOuvert && (
        <nav id="menu-mobile-admin" className="border-b border-border bg-[#0e1512] px-4 py-3 text-white md:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} onNavigate={() => setMenuOuvert(false)} />
            ))}
          </div>
        </nav>
      )}

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const classes = `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
    item.disabled
      ? "cursor-not-allowed text-white/30"
      : active
        ? "bg-primary text-white"
        : "text-white/70 hover:bg-white/5 hover:text-white"
  }`;

  if (item.disabled) {
    return (
      <span className={classes} aria-disabled="true">
        <Icon className="h-5 w-5" aria-hidden="true" />
        {item.label}
        {item.badge ? (
          <span className="ml-auto rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>
        ) : (
          <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/50 uppercase">
            Bientôt
          </span>
        )}
      </span>
    );
  }

  return (
    <Link href={item.href} onClick={onNavigate} className={classes} aria-current={active ? "page" : undefined}>
      <Icon className="h-5 w-5" aria-hidden="true" />
      {item.label}
      {item.badge ? (
        <span className="ml-auto rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>
      ) : null}
    </Link>
  );
}
