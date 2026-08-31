import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import type { ReactNode } from "react";
import { IconGraduationCap } from "@/components/icons";

/**
 * Layout autonome (pas de sidebar) pour le parcours d'abonnement (§2.4, §2.6)
 * — accessible depuis l'espace élève ET l'espace parent, donc volontairement
 * hors des shells `EleveShell`/`ParentShell` plutôt que dupliqué dans les deux
 * (même choix que /inscription, /connexion).
 */
export default async function AbonnementLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session || session.error || (session.user.role !== "ELEVE" && session.user.role !== "PARENT")) {
    redirect("/connexion");
  }

  const retour = session.user.role === "PARENT" ? "/parent" : "/eleve";

  return (
    <div className="min-h-screen bg-fond">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <IconGraduationCap className="h-5 w-5" weight="fill" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold text-texte">Klarity</span>
        </div>
        <Link href={retour} className="text-sm font-medium text-texte-muted hover:text-texte">
          ← Retour au tableau de bord
        </Link>
      </header>
      <main className="px-4 pb-16 sm:px-6">{children}</main>
    </div>
  );
}
