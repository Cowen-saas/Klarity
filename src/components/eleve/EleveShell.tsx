"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { IconHome, IconSparkles, IconDocument, IconBulb, IconPencil, IconUser, IconCreditCard } from "@/components/icons";
import { KlarityLogo } from "@/components/ui/KlarityLogo";
import { SignOutButton } from "@/components/ui/SignOutButton";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/eleve", label: "Accueil", icon: IconHome },
  { href: "/eleve/tuteur-ia", label: "Tuteur IA", icon: IconSparkles },
  { href: "/eleve/epreuves", label: "Épreuves", icon: IconDocument },
  { href: "/eleve/lacunes", label: "Mes lacunes", icon: IconBulb, disabled: true },
  { href: "/eleve/quiz", label: "Quiz", icon: IconPencil, disabled: true },
  { href: "/abonnement?compte=1", label: "Abonnement", icon: IconCreditCard },
  { href: "/eleve/profil", label: "Profil", icon: IconUser },
];

interface EleveShellProps {
  children: ReactNode;
}

export function EleveShell({ children }: EleveShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-fond md:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-[#0e1512] px-4 py-6 text-white md:flex">
        <KlarityLogo wordmark="Klarity" />
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 pt-4">
          <SignOutButton className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-60" />
        </div>
      </aside>

      <div className="flex-1 pb-20 md:pb-0">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface md:hidden">
        {NAV_ITEMS.map((item) => (
          <BottomNavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  const base = href.split("?")[0];
  return base === "/eleve" ? pathname === "/eleve" : pathname.startsWith(base);
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
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/50 uppercase">
          Bientôt
        </span>
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

function BottomNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const classes = `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
    item.disabled ? "text-texte-muted/40" : active ? "text-primary" : "text-texte-muted"
  }`;

  if (item.disabled) {
    return (
      <span className={classes} aria-disabled="true">
        <Icon className="h-5 w-5" aria-hidden="true" />
        {item.label}
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
