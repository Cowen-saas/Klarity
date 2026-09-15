import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EnfantSelector } from "@/components/parent/EnfantSelector";
import { AlertesIntelligentes } from "@/components/parent/AlertesIntelligentes";
import { BarChart } from "@/components/ui/BarChart";
import { resoudreContexteEleve, CLASSE_LABELS } from "@/lib/parent/contexte-eleve";
import { calculerAlertes } from "@/lib/parent/alertes";

export const metadata: Metadata = {
  title: "Progression — Klarity Famille",
  robots: { index: false, follow: false },
};

const NOMS_MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

/**
 * Écran Progression (§2.2, détail visible sur la maquette 11 — graphique
 * d'évolution + alertes intelligentes, ici en version dédiée et complète
 * plutôt que condensée). Lecture seule, données réelles (Passe 2-5).
 */
export default async function ParentProgressionPage({ searchParams }: PageProps<"/parent/progression">) {
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

  const sixMoisAvant = new Date();
  sixMoisAvant.setMonth(sixMoisAvant.getMonth() - 5);
  sixMoisAvant.setDate(1);
  sixMoisAvant.setHours(0, 0, 0, 0);

  const [corrections, alertes] = await Promise.all([
    prisma.correctionDetail.findMany({
      where: { eleveId: eleve.id },
      select: { note: true, createdAt: true, matiere: { select: { nom: true } } },
    }),
    calculerAlertes(eleve.id),
  ]);

  const donneesGraphique = Array.from({ length: 6 }, (_, i) => {
    const mois = new Date(sixMoisAvant);
    mois.setMonth(mois.getMonth() + i);
    const finMois = new Date(mois.getFullYear(), mois.getMonth() + 1, 1);
    const notesMois = corrections.filter((c) => c.createdAt >= mois && c.createdAt < finMois && c.note !== null).map((c) => c.note as number);
    const moyenne = notesMois.length > 0 ? notesMois.reduce((s, n) => s + n, 0) / notesMois.length : 0;
    return { label: NOMS_MOIS[mois.getMonth()], value: Math.round(moyenne * 10) / 10 };
  });

  const parMatiere = new Map<string, number[]>();
  for (const c of corrections) {
    if (c.note === null) continue;
    const liste = parMatiere.get(c.matiere.nom) ?? [];
    liste.push(c.note);
    parMatiere.set(c.matiere.nom, liste);
  }
  const synthesesMatieres = Array.from(parMatiere.entries())
    .map(([matiere, notes]) => ({
      matiere,
      moyenne: notes.reduce((s, n) => s + n, 0) / notes.length,
      nombre: notes.length,
    }))
    .sort((a, b) => a.moyenne - b.moyenne);

  return (
    <main className="max-w-5xl px-6 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-texte">Progression</h1>
          <p className="mt-1 text-sm text-texte-muted">
            {eleve.nom} · {classeLabel}
            {eleve.filiere ? ` · Série ${eleve.filiere}` : ""}
          </p>
        </div>
        <EnfantSelector enfants={liens.map((l) => ({ id: l.eleveId, nom: l.eleve.nom }))} selectedId={selectedId} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-base font-bold text-texte">Évolution des performances</h2>
          <div className="mt-4">
            <BarChart data={donneesGraphique} valueFormatter={(v) => `${v}/20`} emptyMessage="Pas encore de données à afficher." />
          </div>
        </section>
        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-base font-bold text-texte">Alertes intelligentes</h2>
          <AlertesIntelligentes alertes={alertes} nomEleve={eleve.nom} />
        </section>
      </div>

      <section className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
        <h2 className="text-base font-bold text-texte">Moyenne par matière</h2>
        {synthesesMatieres.length === 0 ? (
          <p className="mt-3 text-sm text-texte-muted">Aucune épreuve corrigée pour l&apos;instant.</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {synthesesMatieres.map((s) => (
              <div key={s.matiere} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-texte">{s.matiere}</p>
                  <p className="text-xs text-texte-muted">
                    {s.nombre} épreuve{s.nombre > 1 ? "s" : ""} corrigée{s.nombre > 1 ? "s" : ""}
                  </p>
                </div>
                <p className="font-serif text-lg font-bold text-texte">{s.moyenne.toFixed(1).replace(".", ",")}/20</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
