import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { IconFlag } from "@/components/icons";
import { CorrectionSignaleeDetail } from "@/components/admin/CorrectionSignaleeDetail";

export const metadata: Metadata = {
  title: "Corrections signalées — Admin Klarity",
  robots: { index: false, follow: false },
};

const MOTIF_LABELS: Record<string, string> = {
  LECTURE_ILLISIBLE: "Lecture illisible",
  BAREME_INCORRECT: "Barème mal appliqué",
  AUTRE: "Autre",
};

/**
 * File de revue des corrections contestées (§2.3, §2.8). Vide pour l'instant :
 * aucune correction n'existe tant que la banque d'épreuves et le pipeline de
 * correction ne sont pas alimentés. L'écran (liste + détail + override manuel
 * de note) est prêt.
 */
export default async function AdminCorrectionsSignaleesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    redirect("/admin/connexion");
  }

  const { id } = await searchParams;

  const signalees = await prisma.correctionDetail.findMany({
    where: { signalee: true },
    orderBy: [{ dateTraitementSignalement: "asc" }, { dateSignalement: "desc" }],
    select: {
      id: true,
      motifSignalement: true,
      dateSignalement: true,
      dateTraitementSignalement: true,
      eleve: { select: { codeEleve: true } },
      epreuve: { select: { titre: true } },
      matiere: { select: { nom: true } },
    },
  });

  const enAttente = signalees.filter((s) => s.dateTraitementSignalement === null).length;

  const selection = id
    ? await prisma.correctionDetail.findFirst({
        where: { id, signalee: true },
        select: {
          id: true,
          note: true,
          noteOverride: true,
          justificationOverride: true,
          feedbackDetaille: true,
          commentaireEleve: true,
          motifSignalement: true,
          dateSignalement: true,
          dateTraitementSignalement: true,
          eleve: { select: { codeEleve: true } },
          epreuve: { select: { titre: true } },
          matiere: { select: { nom: true } },
        },
      })
    : null;

  return (
    <main className="max-w-6xl px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-texte">Corrections signalées</h1>
        {enAttente > 0 && (
          <span className="rounded-full bg-danger-light px-3 py-1 text-xs font-bold text-danger">{enAttente} en attente</span>
        )}
      </div>
      <p className="mt-1 text-sm text-texte-muted">
        Corrections contestées par les élèves (§2.8). Ouvre-en une pour consulter le détail et forcer une nouvelle note.
      </p>

      {signalees.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-16 text-center shadow-sm">
          <IconFlag className="h-8 w-8 text-texte-muted" aria-hidden="true" />
          <p className="max-w-md text-sm text-texte-muted">
            Aucune correction signalée pour l&apos;instant. Il n&apos;y aura de contestation possible qu&apos;une fois la
            banque d&apos;épreuves et le pipeline de correction en place.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
          <section className="rounded-2xl bg-surface p-6 shadow-sm">
            <h2 className="text-base font-bold text-texte">Corrections contestées</h2>
            <div className="mt-3 divide-y divide-border">
              {signalees.map((s) => {
                const actif = s.id === id;
                return (
                  <Link
                    key={s.id}
                    href={`/admin/corrections-signalees?id=${s.id}`}
                    className={`block rounded-lg px-3 py-3 transition-colors ${actif ? "bg-primary-light" : "hover:bg-fond"}`}
                    aria-current={actif ? "true" : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-texte">{s.eleve.codeEleve}</p>
                      {s.dateTraitementSignalement ? (
                        <span className="rounded-full bg-success-light px-2 py-0.5 text-[10px] font-bold text-success">Traité</span>
                      ) : (
                        <span className="rounded-full bg-accent-light px-2 py-0.5 text-[10px] font-bold text-texte">En attente</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-texte-muted">
                      {s.epreuve.titre} · {s.matiere.nom}
                    </p>
                    <p className="mt-0.5 text-xs text-texte-muted">
                      {MOTIF_LABELS[s.motifSignalement ?? "AUTRE"] ?? s.motifSignalement} ·{" "}
                      {s.dateSignalement?.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) ?? "—"}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>

          {selection ? (
            <CorrectionSignaleeDetail
              correction={{
                id: selection.id,
                codeEleve: selection.eleve.codeEleve,
                epreuve: selection.epreuve.titre,
                matiere: selection.matiere.nom,
                motif: MOTIF_LABELS[selection.motifSignalement ?? "AUTRE"] ?? selection.motifSignalement ?? "—",
                commentaireEleve: selection.commentaireEleve,
                noteIA: selection.note,
                noteOverride: selection.noteOverride,
                justificationOverride: selection.justificationOverride,
                feedbackDetaille: selection.feedbackDetaille,
                dejaTraite: selection.dateTraitementSignalement !== null,
              }}
            />
          ) : (
            <section className="flex items-center justify-center rounded-2xl bg-surface p-6 text-center shadow-sm">
              <p className="text-sm text-texte-muted">Sélectionne une correction signalée dans la liste pour la traiter.</p>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
