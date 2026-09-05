import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { IconUsers, IconUser, IconShield } from "@/components/icons";

export const metadata: Metadata = {
  title: "Utilisateurs — Admin Klarity",
  robots: { index: false, follow: false },
};

const CLASSE_LABELS: Record<string, string> = {
  TROISIEME: "3ᵉ",
  PREMIERE: "1ʳᵉ",
  TERMINALE: "Terminale",
};

/** Masque un numéro de téléphone : garde l'indicatif et les 2 derniers chiffres. */
function telephoneMasque(tel: string): string {
  if (tel.length <= 4) return tel;
  const debut = tel.startsWith("+") ? tel.slice(0, 4) : tel.slice(0, 3);
  return `${debut} •••• ${tel.slice(-2)}`;
}

/**
 * Synthèse « Utilisateurs » (§2.3) — vue d'ensemble des trois rôles à partir des
 * données réelles en base (`eleves`, `parents`, `admins`). Les listes détaillées
 * et paginées vivent sur `/admin/eleves` et `/admin/parents`. Aucune donnée
 * sensible ici : jamais de `pinHash`, jamais de `twoFactorSecret`.
 */
export default async function AdminUtilisateursPage() {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    redirect("/admin/connexion");
  }

  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);

  const [
    elevesCount,
    parentsCount,
    adminsCount,
    elevesActifs,
    elevesInactifs,
    elevesAnonymises,
    parentsLies,
    elevesCeMois,
    parentsCeMois,
    derniersEleves,
    derniersParents,
  ] = await Promise.all([
    prisma.eleve.count(),
    prisma.parent.count(),
    prisma.admin.count(),
    prisma.eleve.count({ where: { statutCompte: "ACTIF" } }),
    prisma.eleve.count({ where: { statutCompte: "INACTIF_NOTIFIE" } }),
    prisma.eleve.count({ where: { statutCompte: "ANONYMISE" } }),
    prisma.parent.count({ where: { liensEleve: { some: {} } } }),
    prisma.eleve.count({ where: { createdAt: { gte: debutMois } } }),
    prisma.parent.count({ where: { createdAt: { gte: debutMois } } }),
    prisma.eleve.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, nom: true, codeEleve: true, classe: true, filiere: true, statutCompte: true, createdAt: true },
    }),
    prisma.parent.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        telephone: true,
        createdAt: true,
        derniereConnexion: true,
        _count: { select: { liensEleve: true } },
      },
    }),
  ]);

  const derniersInscrits = [
    ...derniersEleves.map((e) => ({
      cle: `e-${e.id}`,
      role: "Élève" as const,
      identifiant: e.codeEleve,
      detail: `${e.nom} · ${CLASSE_LABELS[e.classe] ?? e.classe}${e.filiere ? ` ${e.filiere}` : ""}`,
      createdAt: e.createdAt,
    })),
    ...derniersParents.map((p) => ({
      cle: `p-${p.id}`,
      role: "Parent" as const,
      identifiant: telephoneMasque(p.telephone),
      detail: `${p._count.liensEleve} enfant${p._count.liensEleve > 1 ? "s" : ""} lié${p._count.liensEleve > 1 ? "s" : ""}`,
      createdAt: p.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8);

  return (
    <main className="max-w-6xl px-6 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-texte">Utilisateurs</h1>
      <p className="mt-1 text-sm text-texte-muted">
        Vue d&apos;ensemble des comptes Élève, Parent et Admin. Les listes détaillées sont sur{" "}
        <Link href="/admin/eleves" className="font-semibold text-primary hover:underline">
          Élèves
        </Link>{" "}
        et{" "}
        <Link href="/admin/parents" className="font-semibold text-primary hover:underline">
          Parents
        </Link>
        .
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RoleTile
          icon={IconUser}
          label="Élèves inscrits"
          valeur={elevesCount}
          delta={`▲ ${elevesCeMois} ce mois`}
          href="/admin/eleves"
        />
        <RoleTile
          icon={IconUsers}
          label="Parents inscrits"
          valeur={parentsCount}
          delta={`▲ ${parentsCeMois} ce mois`}
          href="/admin/parents"
        />
        <RoleTile icon={IconShield} label="Comptes admin" valeur={adminsCount} delta="Création CLI uniquement" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-base font-bold text-texte">État des comptes élève</h2>
          <div className="mt-4 space-y-2">
            <StatutLigne label="Actifs" valeur={elevesActifs} ton="ok" />
            <StatutLigne label="Inactifs notifiés" valeur={elevesInactifs} ton={elevesInactifs > 0 ? "attention" : "ok"} />
            <StatutLigne label="Anonymisés (rétention §2.9)" valeur={elevesAnonymises} ton="muted" />
          </div>
        </section>

        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-base font-bold text-texte">Liaison parent ↔ enfant</h2>
          <div className="mt-4 space-y-2">
            <StatutLigne label="Parents avec au moins un enfant lié" valeur={parentsLies} ton="ok" />
            <StatutLigne
              label="Parents sans lien vérifié"
              valeur={parentsCount - parentsLies}
              ton={parentsCount - parentsLies > 0 ? "attention" : "ok"}
            />
          </div>
          <p className="mt-4 text-xs text-texte-muted">
            Un parent sans lien vérifié ne voit aucune donnée (le dashboard reste vide tant que le lien SMS n&apos;est
            pas établi).
          </p>
        </section>
      </div>

      <section className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
        <h2 className="text-base font-bold text-texte">Derniers inscrits</h2>
        {derniersInscrits.length === 0 ? (
          <p className="mt-4 text-sm text-texte-muted">Aucun compte pour l&apos;instant.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-texte-muted uppercase">
                  <th className="pb-2 font-semibold">Rôle</th>
                  <th className="pb-2 font-semibold">Identifiant</th>
                  <th className="pb-2 font-semibold">Détail</th>
                  <th className="pb-2 font-semibold">Inscrit le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {derniersInscrits.map((u) => (
                  <tr key={u.cle}>
                    <td className="py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          u.role === "Élève" ? "bg-primary-light text-primary" : "bg-accent-light text-texte"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 font-semibold text-texte">{u.identifiant}</td>
                    <td className="py-2.5 text-texte-muted">{u.detail}</td>
                    <td className="py-2.5 text-texte-muted">
                      {u.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function RoleTile({
  icon: Icon,
  label,
  valeur,
  delta,
  href,
}: {
  icon: typeof IconUser;
  label: string;
  valeur: number;
  delta: string;
  href?: string;
}) {
  const contenu = (
    <>
      <div className="flex items-center gap-2 text-texte-muted">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <p className="text-xs">{label}</p>
      </div>
      <p className="mt-1 font-serif text-2xl font-bold text-texte">{valeur.toLocaleString("fr-FR")}</p>
      <p className="mt-1 text-xs font-semibold text-success">{delta}</p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="rounded-2xl bg-surface p-5 shadow-sm transition-colors hover:bg-fond">
        {contenu}
      </Link>
    );
  }
  return <div className="rounded-2xl bg-surface p-5 shadow-sm">{contenu}</div>;
}

function StatutLigne({ label, valeur, ton }: { label: string; valeur: number; ton: "ok" | "attention" | "muted" }) {
  const styles =
    ton === "attention" ? "bg-accent-light text-texte" : ton === "muted" ? "bg-fond text-texte-muted" : "bg-fond text-texte";
  return (
    <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold ${styles}`}>
      <p>{label}</p>
      <p>{valeur.toLocaleString("fr-FR")}</p>
    </div>
  );
}
