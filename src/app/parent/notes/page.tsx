import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EnfantSelector } from "@/components/parent/EnfantSelector";
import { resoudreContexteEleve, CLASSE_LABELS } from "@/lib/parent/contexte-eleve";

export const metadata: Metadata = {
  title: "Notes — Klarity Famille",
  robots: { index: false, follow: false },
};

/**
 * Écran Notes (§2.2) — aucune maquette dédiée (seul un extrait de 4 lignes
 * apparaît sur la vue d'ensemble, maquette 11) : historique complet, lecture
 * seule, cohérent visuellement avec le reste du dashboard parent.
 */
export default async function ParentNotesPage({ searchParams }: PageProps<"/parent/notes">) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "PARENT") {
    redirect("/connexion");
  }

  const { eleve: eleveParam } = await searchParams;
  const idParam = Array.isArray(eleveParam) ? eleveParam[0] : eleveParam;
  const { liens, eleve, selectedId } = await resoudreContexteEleve(session.user.id, idParam);

  if (!eleve) {
    return (
      <main className="max-w-3xl px-6 py-10 sm:px-8">
        <h1 className="text-2xl font-bold text-texte">Aucun enfant lié pour l&apos;instant</h1>
      </main>
    );
  }
  const classeLabel = CLASSE_LABELS[eleve.classe] ?? eleve.classe;

  const corrections = await prisma.correctionDetail.findMany({
    where: { eleveId: eleve.id },
    orderBy: { createdAt: "desc" },
    select: { note: true, createdAt: true, epreuve: { select: { titre: true } }, matiere: { select: { nom: true } } },
  });

  return (
    <main className="max-w-4xl px-6 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-texte">Notes</h1>
          <p className="mt-1 text-sm text-texte-muted">
            {eleve.nom} · {classeLabel}
            {eleve.filiere ? ` · Série ${eleve.filiere}` : ""}
          </p>
        </div>
        <EnfantSelector enfants={liens.map((l) => ({ id: l.eleveId, nom: l.eleve.nom }))} selectedId={selectedId} />
      </div>

      <section className="rounded-2xl bg-surface p-6 shadow-sm">
        <h2 className="text-base font-bold text-texte">Historique des épreuves corrigées</h2>
        {corrections.length === 0 ? (
          <p className="mt-3 text-sm text-texte-muted">Aucune épreuve corrigée pour l&apos;instant.</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {corrections.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-texte">{c.epreuve.titre}</p>
                  <p className="text-xs text-texte-muted">
                    {c.matiere.nom} · {c.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <p className="font-serif text-lg font-bold text-texte">{c.note ?? "—"}/20</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
