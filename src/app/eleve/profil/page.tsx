import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/Avatar";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { ProfilCodeEleve } from "@/components/eleve/ProfilCodeEleve";
import { IconGraduationCap, IconCalendarBlank, IconCreditCard } from "@/components/icons";

export const metadata: Metadata = {
  title: "Profil — Klarity",
};

const CLASSE_LABELS: Record<string, string> = {
  TROISIEME: "3e",
  PREMIERE: "1ère",
  TERMINALE: "Terminale",
};

/**
 * Écran "Profil" élève — aucune maquette dédiée (comme la carte vidéo du
 * chantier §2.5 et l'écran quiz corrigé précédemment). Corrige le même défaut
 * structurel que `/eleve/quiz` (§68) : `max-w-2xl` sans `mx-auto` collait le
 * contenu dans un coin. Repris ici avec la même largeur/le même patron de
 * grille que le tableau de bord (`/eleve`, `max-w-5xl`, `Avatar` réutilisé à
 * l'identique) plutôt qu'une simple recentrage — la demande explicite était
 * d'exploiter l'espace, pas seulement de le centrer.
 */
export default async function EleveProfilPage() {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ELEVE") {
    redirect("/connexion?from=/eleve/profil");
  }

  const [eleve, abonnement] = await Promise.all([
    prisma.eleve.findUnique({ where: { id: session.user.id }, select: { createdAt: true } }),
    prisma.abonnement.findFirst({ where: { eleveId: session.user.id }, orderBy: { dateDebut: "desc" } }),
  ]);

  const nom = session.user.nom ?? "—";
  const classe = session.user.classe ? (CLASSE_LABELS[session.user.classe] ?? session.user.classe) : "—";
  const membreDepuis = eleve?.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const estPremiumActif = abonnement?.plan === "PREMIUM" && abonnement.statut === "ACTIF";

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 sm:px-8">
      <div className="flex items-center gap-4">
        <Avatar seed={session.user.id} nom={nom} size={72} />
        <div>
          <h1 className="text-2xl font-bold text-texte">{nom}</h1>
          <p className="mt-1 text-sm text-texte-muted">
            {classe}
            {session.user.filiere ? ` · Série ${session.user.filiere}` : ""} · Élève
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-base font-bold text-texte">Informations du compte</h2>
          <dl className="mt-4 divide-y divide-border">
            <div className="flex items-center gap-3 py-3">
              <IconGraduationCap className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <dt className="flex-1 text-sm text-texte-muted">Classe</dt>
              <dd className="text-sm font-semibold text-texte">
                {classe}
                {session.user.filiere ? ` · Série ${session.user.filiere}` : ""}
              </dd>
            </div>
            <div className="flex items-center gap-3 py-3">
              <IconCalendarBlank className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <dt className="flex-1 text-sm text-texte-muted">Membre depuis</dt>
              <dd className="text-sm font-semibold text-texte">{membreDepuis ?? "—"}</dd>
            </div>
          </dl>

          <div className="mt-6 border-t border-border pt-6">
            <ProfilCodeEleve code={session.user.codeEleve ?? "—"} />
            <p className="mt-3 text-sm text-texte-muted">
              Donne ce code à ton parent avec ton numéro de téléphone : c&apos;est ce qui lui permet de suivre ta
              progression.
            </p>
          </div>
        </div>

        <div className={`flex flex-col rounded-2xl p-6 ${estPremiumActif ? "bg-primary text-white" : "bg-surface shadow-sm"}`}>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              estPremiumActif ? "bg-white/15" : "bg-primary-light text-primary"
            }`}
          >
            <IconCreditCard className="h-5 w-5" weight={estPremiumActif ? "fill" : "regular"} aria-hidden="true" />
          </div>
          <p className={`mt-4 text-xs font-semibold tracking-wide uppercase ${estPremiumActif ? "text-white/70" : "text-texte-muted"}`}>
            Abonnement
          </p>
          <p className={`mt-1 text-lg font-bold ${estPremiumActif ? "text-white" : "text-texte"}`}>
            {estPremiumActif ? "Premium actif" : "Formule Gratuite"}
          </p>
          {estPremiumActif && abonnement?.dateFin && (
            <p className="mt-1 text-sm text-white/80">Jusqu&apos;au {abonnement.dateFin.toLocaleDateString("fr-FR")}</p>
          )}
          {!estPremiumActif && (
            <Link
              href="/abonnement"
              className="mt-4 block rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Passer à Premium
            </Link>
          )}
        </div>
      </div>

      <SignOutButton className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-surface py-3 text-center text-sm font-semibold text-texte transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-60 lg:w-auto" />
    </main>
  );
}
