import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { IconUsers } from "@/components/icons";
import { Pagination, lirePage } from "@/components/admin/Pagination";

export const metadata: Metadata = {
  title: "Parents — Admin Klarity",
  robots: { index: false, follow: false },
};

const PAR_PAGE = 15;

/** Masque un numéro de téléphone : garde l'indicatif et les 2 derniers chiffres. */
function telephoneMasque(tel: string): string {
  if (tel.length <= 4) return tel;
  const debut = tel.startsWith("+") ? tel.slice(0, 4) : tel.slice(0, 3);
  return `${debut} •••• ${tel.slice(-2)}`;
}

function connexionRelative(date: Date | null): string {
  if (!date) return "Jamais";
  const jours = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (jours <= 0) return "Aujourd'hui";
  if (jours === 1) return "Hier";
  if (jours < 30) return `Il y a ${jours} j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Liste paginée des comptes parent (§2.3). Le téléphone (identifiant de
 * connexion) est masqué — l'admin n'a pas besoin du numéro complet ici. On
 * affiche les enfants liés via `ParentEleveLink` (lien vérifié par OTP, §2.7).
 */
export default async function AdminParentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    redirect("/admin/connexion");
  }

  const total = await prisma.parent.count();
  const totalPages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const { page: pageParam } = await searchParams;
  const page = lirePage(pageParam, totalPages);

  const parents = await prisma.parent.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAR_PAGE,
    take: PAR_PAGE,
    select: {
      id: true,
      telephone: true,
      createdAt: true,
      derniereConnexion: true,
      liensEleve: {
        select: { eleve: { select: { codeEleve: true, nom: true } } },
        orderBy: { dateLiaison: "asc" },
      },
    },
  });

  const avecLien = parents.filter((p) => p.liensEleve.length > 0).length;

  return (
    <main className="max-w-6xl px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-texte">Parents</h1>
        <span className="rounded-full bg-fond px-3 py-1 text-xs font-semibold text-texte-muted">
          {total.toLocaleString("fr-FR")} compte{total > 1 ? "s" : ""}
        </span>
      </div>
      <p className="mt-1 text-sm text-texte-muted">
        Comptes parent réels et leurs enfants liés (lien vérifié par SMS, §2.7). Numéro masqué. Lecture seule.
      </p>

      <section className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
        {parents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-fond px-4 py-12 text-center">
            <IconUsers className="h-6 w-6 text-texte-muted" aria-hidden="true" />
            <p className="text-sm text-texte-muted">Aucun parent inscrit pour l&apos;instant.</p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-xs text-texte-muted">
              {avecLien} / {parents.length} affiché{parents.length > 1 ? "s" : ""} ont au moins un enfant lié.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-texte-muted uppercase">
                    <th className="pb-2 font-semibold">Téléphone</th>
                    <th className="pb-2 font-semibold">Enfants liés</th>
                    <th className="pb-2 font-semibold">Dernière connexion</th>
                    <th className="pb-2 font-semibold">Inscrit le</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parents.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 font-serif font-semibold text-texte">{telephoneMasque(p.telephone)}</td>
                      <td className="py-2.5 text-texte-muted">
                        {p.liensEleve.length === 0 ? (
                          <span className="rounded-full bg-accent-light px-2 py-0.5 text-xs font-bold text-texte">
                            Aucun lien
                          </span>
                        ) : (
                          <span className="flex flex-wrap gap-1.5">
                            {p.liensEleve.map((l) => (
                              <span
                                key={l.eleve.codeEleve}
                                className="rounded-full bg-primary-light px-2 py-0.5 font-serif text-xs font-semibold text-primary"
                                title={l.eleve.nom}
                              >
                                {l.eleve.codeEleve}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-texte-muted">{connexionRelative(p.derniereConnexion)}</td>
                      <td className="py-2.5 text-texte-muted">
                        {p.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} basePath="/admin/parents" />
          </>
        )}
      </section>
    </main>
  );
}
