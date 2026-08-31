"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { IconChart, IconPencil, IconBulb, IconClock, IconBell, IconSettings, IconCreditCard } from "@/components/icons";
import { KlarityLogo } from "@/components/ui/KlarityLogo";
import { SignOutButton } from "@/components/ui/SignOutButton";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/parent", label: "Vue d'ensemble", icon: IconChart },
  { href: "/parent/progression", label: "Progression", icon: IconChart, disabled: true },
  { href: "/parent/notes", label: "Notes", icon: IconPencil, disabled: true },
  { href: "/parent/lacunes", label: "Lacunes", icon: IconBulb, disabled: true },
  { href: "/parent/temps-passe", label: "Temps passé", icon: IconClock, disabled: true },
  { href: "/parent/notifications", label: "Notifications", icon: IconBell },
  { href: "/abonnement", label: "Abonnement", icon: IconCreditCard },
  { href: "/parent/parametres", label: "Paramètres", icon: IconSettings, disabled: true },
];

export function ParentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-fond md:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-[#0e1512] px-4 py-6 text-white md:flex">
        <KlarityLogo wordmark="Klarity Famille" />
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
        <SignOutButton className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-60" />
      </aside>

      <div className="flex-1">{children}</div>
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  return href === "/parent" ? pathname === "/parent" : pathname.startsWith(href);
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
