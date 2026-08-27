"use client";

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
    { href: "/admin/utilisateurs", label: "Utilisateurs", icon: IconUsers, disabled: true },
    { href: "/admin/eleves", label: "Élèves", icon: IconUser, disabled: true },
    { href: "/admin/parents", label: "Parents", icon: IconUsers, disabled: true },
    { href: "/admin/epreuves", label: "Épreuves", icon: IconDocument, disabled: true },
    { href: "/admin/exemples-corriges", label: "Exemples corrigés", icon: IconPencil, disabled: true },
    {
      href: "/admin/corrections-signalees",
      label: "Corrections signalées",
      icon: IconFlag,
      disabled: true,
      badge: correctionsSignaleesCount,
    },
    { href: "/admin/dates-examens", label: "Dates d'examens", icon: IconCalendar, disabled: true },
    { href: "/admin/usage-ia", label: "Usage IA", icon: IconSparkles, disabled: true },
    { href: "/admin/securite", label: "Sécurité", icon: IconShield, disabled: true },
    { href: "/admin/paiements", label: "Paiements", icon: IconCreditCard, disabled: true },
    { href: "/admin/revenus", label: "Revenus", icon: IconCoins, disabled: true },
    { href: "/admin/parametres", label: "Paramètres", icon: IconSettings, disabled: true },
  ];
}

export function AdminShell({ children, correctionsSignaleesCount }: { children: ReactNode; correctionsSignaleesCount: number }) {
  const pathname = usePathname();
  const navItems = buildNavItems(correctionsSignaleesCount);

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

      <div className="flex-1">{children}</div>
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
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
    <Link href={item.href} className={classes} aria-current={active ? "page" : undefined}>
      <Icon className="h-5 w-5" aria-hidden="true" />
      {item.label}
    </Link>
  );
}
