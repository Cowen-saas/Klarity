import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DateExamenManager } from "@/components/admin/DateExamenManager";

export const metadata: Metadata = {
  title: "Dates d'examens — Admin Klarity",
  robots: { index: false, follow: false },
};

/**
 * Gestion du calendrier d'examens (§2.3, §4.2.1). C'est la source du compte à
 * rebours « BAC dans N jours » des dashboards élève/parent, aujourd'hui masqué
 * faute de données (cf. docs/PROGRESS.md).
 */
export default async function AdminDatesExamensPage() {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    redirect("/admin/connexion");
  }

  const dates = await prisma.dateExamen.findMany({
    orderBy: [{ anneeScolaire: "desc" }, { typeExamen: "asc" }],
    select: {
      id: true,
      typeExamen: true,
      anneeScolaire: true,
      dateExamen: true,
      datePeriodeEstimee: true,
      updatedAt: true,
    },
  });

  return (
    <main className="max-w-4xl px-6 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-texte">Dates d&apos;examens</h1>
      <p className="mt-1 text-sm text-texte-muted">
        BEPC, Probatoire et BAC par année scolaire — date précise ou période estimée. Alimente le compte à rebours des
        tableaux de bord élève et parent.
      </p>

      <div className="mt-6">
        <DateExamenManager
          dates={dates.map((d) => ({
            ...d,
            dateExamen: d.dateExamen ? d.dateExamen.toISOString() : null,
            updatedAt: d.updatedAt.toISOString(),
          }))}
        />
      </div>
    </main>
  );
}
