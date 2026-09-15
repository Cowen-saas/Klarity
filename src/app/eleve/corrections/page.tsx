import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { IconRobot, IconDocument } from "@/components/icons";

export const metadata: Metadata = {
  title: "Mes copies — Klarity",
};

/**
 * Hub "Mes copies" (nouveau point d'entrée centralisé du pipeline de
 * correction, §2.1, §4.3) — jusqu'ici le flux upload/résultat n'était
 * accessible que depuis une épreuve précise dans la banque, sans nul autre
 * endroit pour retrouver une correction passée. Liste : les corrections déjà
 * produites, puis toute tentative encore en cours de traitement.
 */
export default async function MesCopiesPage() {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ELEVE") {
    redirect("/connexion?from=/eleve/corrections");
  }

  const eleveId = session.user.id;

  const [corrections, tentativesEnCours] = await Promise.all([
    prisma.correctionDetail.findMany({
      where: { eleveId },
      orderBy: { createdAt: "desc" },
      select: {
        epreuveId: true,
        note: true,
        createdAt: true,
        epreuve: { select: { titre: true, anneeScolaire: true } },
        matiere: { select: { nom: true } },
      },
    }),
    prisma.tentativeEpreuve.findMany({
      where: { eleveId, statut: { in: ["EN_ATTENTE", "EN_TRAITEMENT"] } },
      orderBy: { dateSoumission: "desc" },
      select: { epreuveId: true, statut: true, epreuve: { select: { titre: true } } },
    }),
  ]);

  const epreuvesDejaCorrigees = new Set(corrections.map((c) => c.epreuveId));
  const enCoursAffichees = tentativesEnCours.filter((t) => !epreuvesDejaCorrigees.has(t.epreuveId));

  const total = corrections.length + enCoursAffichees.length;

  return (
    <main className="max-w-3xl px-6 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-texte">Mes copies</h1>
      <p className="mt-1 text-sm text-texte-muted">
        Retrouve ici toutes les copies que tu as envoyées à l&apos;IA, et leur correction.
      </p>

      {total === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl bg-surface px-6 py-12 text-center shadow-sm">
          <IconRobot className="h-8 w-8 text-texte-muted" aria-hidden="true" />
          <h2 className="mt-2 text-base font-bold text-texte">Aucune copie envoyée pour l&apos;instant</h2>
          <p className="max-w-md text-sm text-texte-muted">
            Choisis une épreuve dans la banque, télécharge-la, travaille-la sur papier, puis reviens photographier ta
            copie — le bouton « Envoie ta copie » est sur chaque fiche d&apos;épreuve.
          </p>
          <Link
            href="/eleve/epreuves"
            className="mt-3 flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <IconDocument className="h-4 w-4" aria-hidden="true" />
            Voir la banque d&apos;épreuves
          </Link>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-surface p-2 shadow-sm">
          {enCoursAffichees.map((t) => (
            <Link
              key={t.epreuveId}
              href={`/eleve/epreuves/${t.epreuveId}/correction`}
              className="flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 transition-colors hover:bg-fond"
            >
              <div>
                <p className="text-sm font-semibold text-texte">{t.epreuve.titre}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-accent">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
                  Analyse en cours…
                </p>
              </div>
            </Link>
          ))}
          {corrections.map((c) => (
            <Link
              key={c.epreuveId}
              href={`/eleve/epreuves/${c.epreuveId}/correction`}
              className="flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 transition-colors hover:bg-fond"
            >
              <div>
                <p className="text-sm font-semibold text-texte">{c.epreuve.titre}</p>
                <p className="mt-0.5 text-xs text-texte-muted">
                  {c.matiere.nom} · {c.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <p className="font-serif text-lg font-bold text-texte">{c.note ?? "—"}/20</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
