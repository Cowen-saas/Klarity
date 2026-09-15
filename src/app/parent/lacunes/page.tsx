import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EnfantSelector } from "@/components/parent/EnfantSelector";
import { resoudreContexteEleve, CLASSE_LABELS } from "@/lib/parent/contexte-eleve";
import { IconCheckCircle, IconWarning } from "@/components/icons";

export const metadata: Metadata = {
  title: "Lacunes — Klarity Famille",
  robots: { index: false, follow: false },
};

type Statut = "bon" | "moyen" | "faible";

function statutDe(niveau: number): Statut {
  if (niveau >= 70) return "bon";
  if (niveau >= 40) return "moyen";
  return "faible";
}

const BARRE_PAR_STATUT: Record<Statut, string> = { bon: "bg-success", moyen: "bg-accent", faible: "bg-danger" };
const TEXTE_PAR_STATUT: Record<Statut, string> = { bon: "text-success", moyen: "text-accent", faible: "text-danger" };

function Indicateur({ statut }: { statut: Statut }) {
  if (statut === "bon") return <IconCheckCircle className="h-4 w-4 text-success" weight="fill" aria-hidden="true" />;
  if (statut === "moyen") return <IconWarning className="h-4 w-4 text-accent" weight="fill" aria-hidden="true" />;
  return <span className="inline-block h-3 w-3 rounded-full bg-danger" aria-hidden="true" />;
}

/**
 * Écran Lacunes côté parent (§2.2) — aucune maquette dédiée : reprend le
 * langage visuel de "Mes lacunes" côté élève (maquette 09), en **lecture
 * seule** (pas de quiz déclenchable depuis ici — ce n'est pas l'élève qui
 * consulte). Cohérent avec le reste du dashboard parent déjà construit.
 */
export default async function ParentLacunesPage({ searchParams }: PageProps<"/parent/lacunes">) {
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

  const lacunes = await prisma.lacune.findMany({
    where: { eleveId: eleve.id, resolu: false },
    orderBy: { niveauMaitrise: "asc" },
    include: { matiere: { select: { nom: true } } },
  });

  const parMatiere = new Map<string, typeof lacunes>();
  for (const l of lacunes) {
    const liste = parMatiere.get(l.matiere.nom) ?? [];
    liste.push(l);
    parMatiere.set(l.matiere.nom, liste);
  }

  return (
    <main className="max-w-5xl px-6 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-texte">Lacunes</h1>
          <p className="mt-1 text-sm text-texte-muted">
            {eleve.nom} · {classeLabel}
            {eleve.filiere ? ` · Série ${eleve.filiere}` : ""}
          </p>
        </div>
        <EnfantSelector enfants={liens.map((l) => ({ id: l.eleveId, nom: l.eleve.nom }))} selectedId={selectedId} />
      </div>

      {lacunes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface px-6 py-12 text-center shadow-sm">
          <IconCheckCircle className="h-8 w-8 text-success" weight="fill" aria-hidden="true" />
          <h2 className="mt-2 text-base font-bold text-texte">Aucune lacune active</h2>
          <p className="max-w-md text-sm text-texte-muted">
            {eleve.nom} n&apos;a pas de lacune active identifiée pour l&apos;instant.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from(parMatiere.entries()).map(([matiere, items]) => (
            <div key={matiere} className="rounded-2xl bg-surface p-5 shadow-sm">
              <h2 className="text-base font-bold text-texte">{matiere}</h2>
              <div className="mt-3 space-y-3">
                {items.map((l) => {
                  const statut = statutDe(l.niveauMaitrise);
                  return (
                    <div key={l.id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-texte">{l.notion}</span>
                        <span className={`flex items-center gap-1.5 font-bold ${TEXTE_PAR_STATUT[statut]}`}>
                          {l.niveauMaitrise}% <Indicateur statut={statut} />
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-fond">
                        <div className={`h-full rounded-full ${BARRE_PAR_STATUT[statut]}`} style={{ width: `${Math.max(2, l.niveauMaitrise)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
