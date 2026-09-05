import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { IconUser } from "@/components/icons";
import { Pagination, lirePage } from "@/components/admin/Pagination";

export const metadata: Metadata = {
  title: "Élèves — Admin Klarity",
  robots: { index: false, follow: false },
};

const PAR_PAGE = 15;

const CLASSE_LABELS: Record<string, string> = {
  TROISIEME: "3ᵉ",
  PREMIERE: "1ʳᵉ",
  TERMINALE: "Terminale",
};

const STATUT_COMPTE: Record<string, { label: string; classes: string }> = {
  ACTIF: { label: "Actif", classes: "bg-success-light text-success" },
  INACTIF_NOTIFIE: { label: "Inactif notifié", classes: "bg-accent-light text-texte" },
  ANONYMISE: { label: "Anonymisé", classes: "bg-fond text-texte-muted" },
};

function activiteRelative(date: Date | null): string {
  if (!date) return "Jamais";
  const jours = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (jours <= 0) return "Aujourd'hui";
  if (jours === 1) return "Hier";
  if (jours < 30) return `Il y a ${jours} j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Liste paginée des comptes élève (§2.3). Lecture seule, données réelles de la
 * table `eleves`. **Jamais** `pinHash` / `pinVerrouilleJusqua` exposés — on ne
 * sélectionne que l'identité, la scolarité, le statut de rétention et l'activité.
 */
export default async function AdminElevesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    redirect("/admin/connexion");
  }

  const total = await prisma.eleve.count();
  const totalPages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const { page: pageParam } = await searchParams;
  const page = lirePage(pageParam, totalPages);

  const eleves = await prisma.eleve.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAR_PAGE,
    take: PAR_PAGE,
    select: {
      id: true,
      nom: true,
      codeEleve: true,
      classe: true,
      filiere: true,
      statutCompte: true,
      derniereActiviteLe: true,
      createdAt: true,
      _count: { select: { liensParent: true, correctionsDetail: true } },
      abonnements: {
        where: { statut: "ACTIF" },
        select: { plan: true },
        take: 1,
      },
    },
  });

  return (
    <main className="max-w-6xl px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-texte">Élèves</h1>
        <span className="rounded-full bg-fond px-3 py-1 text-xs font-semibold text-texte-muted">
          {total.toLocaleString("fr-FR")} compte{total > 1 ? "s" : ""}
        </span>
      </div>
      <p className="mt-1 text-sm text-texte-muted">
        Comptes élève réels — identité, scolarité, statut de rétention (§2.9) et activité. Lecture seule.
      </p>

      <section className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
        {eleves.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-fond px-4 py-12 text-center">
            <IconUser className="h-6 w-6 text-texte-muted" aria-hidden="true" />
            <p className="text-sm text-texte-muted">Aucun élève inscrit pour l&apos;instant.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-texte-muted uppercase">
                    <th className="pb-2 font-semibold">Élève</th>
                    <th className="pb-2 font-semibold">Classe</th>
                    <th className="pb-2 font-semibold">Statut</th>
                    <th className="pb-2 font-semibold">Dernière activité</th>
                    <th className="pb-2 font-semibold">Parents</th>
                    <th className="pb-2 font-semibold">Épreuves</th>
                    <th className="pb-2 font-semibold">Abonnement</th>
                    <th className="pb-2 font-semibold">Inscrit le</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {eleves.map((e) => {
                    const statut = STATUT_COMPTE[e.statutCompte] ?? {
                      label: e.statutCompte,
                      classes: "bg-fond text-texte-muted",
                    };
                    const plan = e.abonnements[0]?.plan;
                    return (
                      <tr key={e.id}>
                        <td className="py-2.5">
                          <p className="font-semibold text-texte">{e.nom}</p>
                          <p className="font-serif text-xs text-texte-muted">{e.codeEleve}</p>
                        </td>
                        <td className="py-2.5 text-texte-muted">
                          {CLASSE_LABELS[e.classe] ?? e.classe}
                          {e.filiere ? ` · ${e.filiere}` : ""}
                        </td>
                        <td className="py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statut.classes}`}>
                            {statut.label}
                          </span>
                        </td>
                        <td className="py-2.5 text-texte-muted">{activiteRelative(e.derniereActiviteLe)}</td>
                        <td className="py-2.5 text-texte-muted">{e._count.liensParent}</td>
                        <td className="py-2.5 text-texte-muted">{e._count.correctionsDetail}</td>
                        <td className="py-2.5">
                          {plan === "PREMIUM" ? (
                            <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-bold text-primary">
                              Premium
                            </span>
                          ) : (
                            <span className="text-xs text-texte-muted">Gratuit</span>
                          )}
                        </td>
                        <td className="py-2.5 text-texte-muted">
                          {e.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} basePath="/admin/eleves" />
          </>
        )}
      </section>
    </main>
  );
}
