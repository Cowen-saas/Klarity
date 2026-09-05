import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { TypeExerciceCorrection } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { IconPencil } from "@/components/icons";
import { ExempleCorrectionForm } from "@/components/admin/ExempleCorrectionForm";

export const metadata: Metadata = {
  title: "Exemples corrigés — Admin Klarity",
  robots: { index: false, follow: false },
};

const LABELS_TYPE: Record<TypeExerciceCorrection, string> = {
  DISSERTATION_PHILO: "Dissertation philosophique",
  DISSERTATION_LITTERAIRE: "Dissertation littéraire",
  CONTRACTION_TEXTE: "Contraction de texte",
  DISCUSSION: "Discussion",
  COMMENTAIRE_COMPOSE: "Commentaire composé",
  EXPRESSION_ECRITE: "Expression écrite (3ᵉ)",
  CORRECTION_ORTHOGRAPHIQUE: "Correction orthographique (3ᵉ)",
};

/**
 * Gestion des exemples de correction few-shot (§4.2.2). Lecture des lignes
 * `exemples_correction` réelles + ajout via `ExempleCorrectionForm`
 * (`POST /api/admin/exemples-corriges`, gate ADMIN). Ces exemples alimentent le
 * dispositif RAG de `corrigerCopie()`, résolus par matière + type d'exercice.
 */
export default async function AdminExemplesCorrigesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    redirect("/admin/connexion");
  }

  const { id } = await searchParams;

  const [exemples, matieres] = await Promise.all([
    prisma.exempleCorrection.findMany({
      orderBy: [{ matiere: { nom: "asc" } }, { typeExercice: "asc" }],
      select: {
        id: true,
        typeExercice: true,
        langue: true,
        createdAt: true,
        matiere: { select: { nom: true } },
      },
    }),
    prisma.matiere.findMany({
      where: { nom: { in: ["Français", "Philosophie"] } },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true },
    }),
  ]);

  const selection = id
    ? await prisma.exempleCorrection.findUnique({
        where: { id },
        select: {
          id: true,
          typeExercice: true,
          langue: true,
          enonceModele: true,
          baremeStructure: true,
          exempleReponseModele: true,
          notesMethodologiques: true,
          createdAt: true,
          matiere: { select: { nom: true } },
        },
      })
    : null;

  return (
    <main className="max-w-6xl px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-texte">Exemples corrigés</h1>
        <span className="rounded-full bg-fond px-3 py-1 text-xs font-semibold text-texte-muted">
          {exemples.length} exemple{exemples.length > 1 ? "s" : ""}
        </span>
      </div>
      <p className="mt-1 text-sm text-texte-muted">
        Copies modèles Français / Philosophie servant de few-shot au moteur de correction (§4.2.2).
      </p>

      <div className="mt-6">
        <ExempleCorrectionForm matieres={matieres} />
      </div>

      {exemples.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-16 text-center shadow-sm">
          <IconPencil className="h-8 w-8 text-texte-muted" aria-hidden="true" />
          <p className="text-sm text-texte-muted">Aucun exemple de correction pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
          <section className="rounded-2xl bg-surface p-6 shadow-sm">
            <h2 className="text-base font-bold text-texte">Bibliothèque</h2>
            <div className="mt-3 divide-y divide-border">
              {exemples.map((ex) => {
                const actif = ex.id === id;
                return (
                  <Link
                    key={ex.id}
                    href={`/admin/exemples-corriges?id=${ex.id}`}
                    className={`block rounded-lg px-3 py-3 transition-colors ${actif ? "bg-primary-light" : "hover:bg-fond"}`}
                    aria-current={actif ? "true" : undefined}
                  >
                    <p className="text-sm font-semibold text-texte">{LABELS_TYPE[ex.typeExercice] ?? ex.typeExercice}</p>
                    <p className="mt-0.5 text-xs text-texte-muted">
                      {ex.matiere.nom} · {ex.langue} ·{" "}
                      {ex.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>

          {selection ? (
            <section className="space-y-5 rounded-2xl bg-surface p-6 shadow-sm">
              <div>
                <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                  {selection.matiere.nom} · {selection.langue}
                </p>
                <h2 className="mt-1 text-lg font-bold text-texte">
                  {LABELS_TYPE[selection.typeExercice] ?? selection.typeExercice}
                </h2>
              </div>

              <BlocTexte titre="Énoncé modèle" contenu={selection.enonceModele} />

              <div>
                <p className="mb-1.5 text-xs font-bold tracking-wide text-texte-muted uppercase">Barème (structure)</p>
                <pre className="max-h-80 overflow-auto rounded-xl bg-fond p-4 font-mono text-xs text-texte">
                  {JSON.stringify(selection.baremeStructure, null, 2)}
                </pre>
              </div>

              <BlocTexte titre="Exemple de réponse modèle" contenu={selection.exempleReponseModele} />
              <BlocTexte titre="Notes méthodologiques" contenu={selection.notesMethodologiques} />
            </section>
          ) : (
            <section className="flex items-center justify-center rounded-2xl bg-surface p-6 text-center shadow-sm">
              <p className="text-sm text-texte-muted">Sélectionne un exemple dans la bibliothèque pour voir son détail.</p>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function BlocTexte({ titre, contenu }: { titre: string; contenu: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold tracking-wide text-texte-muted uppercase">{titre}</p>
      <div className="max-h-80 overflow-auto rounded-xl bg-fond p-4 text-sm whitespace-pre-wrap text-texte">{contenu}</div>
    </div>
  );
}
