import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ModeleIA, TypeUsageIA } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { IconSparkles } from "@/components/icons";
import { Pagination, lirePage } from "@/components/admin/Pagination";

export const metadata: Metadata = {
  title: "Usage IA — Admin Klarity",
  robots: { index: false, follow: false },
};

const PAR_PAGE = 20;

// Taux d'affichage uniquement — cohérent avec /admin (vue d'ensemble).
// `UsageIA.coutEstime` reste stocké en USD (facturation Anthropic réelle,
// cf. src/lib/ai/pricing.ts) ; converti ici en FCFA (devise produit, §2.4).
const USD_VERS_XAF = 610;

const LABELS_TYPE: Record<TypeUsageIA, string> = {
  CHAT: "Tuteur IA (chat)",
  QUIZ: "Génération de quiz",
  CORRECTION: "Correction de copie",
  VIDEO_FILTRAGE: "Filtrage vidéos",
};

const LABELS_MODELE: Record<ModeleIA, string> = {
  HAIKU: "Haiku",
  SONNET: "Sonnet",
};

function formatFCFA(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

/**
 * Suivi de la consommation IA (§2.3, « cost control on AI usage is a product
 * requirement »). La vue d'ensemble `/admin` montre le coût par utilisateur sur
 * 30 j ; cet écran ajoute les totaux, la répartition par modèle / type d'usage
 * et le journal des appels. Se remplit progressivement — dense une fois
 * `AI_MODE=live`.
 */
export default async function AdminUsageIaPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    redirect("/admin/connexion");
  }

  const ilYa30j = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [total, totauxGlobaux, parModele, parType, coutParEleve30j] = await Promise.all([
    prisma.usageIA.count(),
    prisma.usageIA.aggregate({ _sum: { tokensInput: true, tokensOutput: true, coutEstime: true } }),
    prisma.usageIA.groupBy({ by: ["modele"], _count: { _all: true }, _sum: { coutEstime: true } }),
    prisma.usageIA.groupBy({ by: ["typeUsage"], _count: { _all: true }, _sum: { coutEstime: true } }),
    prisma.usageIA.groupBy({
      by: ["eleveId"],
      where: { date: { gte: ilYa30j }, eleveId: { not: null } },
      _sum: { coutEstime: true },
      _count: { _all: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const { page: pageParam } = await searchParams;
  const page = lirePage(pageParam, totalPages);

  const appels = await prisma.usageIA.findMany({
    orderBy: { date: "desc" },
    skip: (page - 1) * PAR_PAGE,
    take: PAR_PAGE,
    select: {
      id: true,
      typeUsage: true,
      modele: true,
      tokensInput: true,
      tokensOutput: true,
      coutEstime: true,
      date: true,
      eleve: { select: { codeEleve: true } },
    },
  });

  const coutTotalXAF = Number(totauxGlobaux._sum.coutEstime ?? 0) * USD_VERS_XAF;
  const tokensTotal = (totauxGlobaux._sum.tokensInput ?? 0) + (totauxGlobaux._sum.tokensOutput ?? 0);

  // Coût par élève (30 j) — jointure des codes élève.
  const eleveIds = coutParEleve30j.map((u) => u.eleveId).filter((id): id is string => id !== null);
  const elevesUsage = eleveIds.length
    ? await prisma.eleve.findMany({ where: { id: { in: eleveIds } }, select: { id: true, codeEleve: true } })
    : [];
  const codeParId = new Map(elevesUsage.map((e) => [e.id, e.codeEleve]));
  const lignesCoutEleve = coutParEleve30j
    .map((u) => ({
      codeEleve: codeParId.get(u.eleveId as string) ?? "—",
      requetes: u._count._all,
      coutXAF: Number(u._sum.coutEstime ?? 0) * USD_VERS_XAF,
    }))
    .sort((a, b) => b.coutXAF - a.coutXAF);
  const moyenneCoutXAF =
    lignesCoutEleve.length > 0 ? lignesCoutEleve.reduce((s, l) => s + l.coutXAF, 0) / lignesCoutEleve.length : 0;

  return (
    <main className="max-w-6xl px-6 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-texte">Usage IA</h1>
      <p className="mt-1 text-sm text-texte-muted">
        Consommation des appels Claude (§2.3) — le coût par utilisateur est surveillé pour que le revenu
        d&apos;abonnement ne soit pas dépassé par la dépense API sur des profils atypiques.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <UsageTile label="Appels enregistrés" valeur={total.toLocaleString("fr-FR")} />
        <UsageTile label="Tokens totaux" valeur={tokensTotal.toLocaleString("fr-FR")} />
        <UsageTile label="Coût estimé total" valeur={formatFCFA(coutTotalXAF)} />
        <UsageTile
          label="Coût moyen / élève (30j)"
          valeur={lignesCoutEleve.length > 0 ? formatFCFA(moyenneCoutXAF) : "—"}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-base font-bold text-texte">Par modèle</h2>
          {parModele.length === 0 ? (
            <p className="mt-3 text-sm text-texte-muted">Aucun appel enregistré.</p>
          ) : (
            <div className="mt-3 divide-y divide-border">
              {parModele.map((m) => (
                <div key={m.modele} className="flex items-center justify-between py-2.5 text-sm">
                  <p className="font-semibold text-texte">{LABELS_MODELE[m.modele] ?? m.modele}</p>
                  <p className="text-texte-muted">
                    {m._count._all} appel{m._count._all > 1 ? "s" : ""} ·{" "}
                    {formatFCFA(Number(m._sum.coutEstime ?? 0) * USD_VERS_XAF)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-base font-bold text-texte">Par type d&apos;usage</h2>
          {parType.length === 0 ? (
            <p className="mt-3 text-sm text-texte-muted">Aucun appel enregistré.</p>
          ) : (
            <div className="mt-3 divide-y divide-border">
              {parType.map((t) => (
                <div key={t.typeUsage} className="flex items-center justify-between py-2.5 text-sm">
                  <p className="font-semibold text-texte">{LABELS_TYPE[t.typeUsage] ?? t.typeUsage}</p>
                  <p className="text-texte-muted">
                    {t._count._all} appel{t._count._all > 1 ? "s" : ""} ·{" "}
                    {formatFCFA(Number(t._sum.coutEstime ?? 0) * USD_VERS_XAF)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-bold text-texte">Coût par élève — 30 derniers jours</h2>
          {lignesCoutEleve.length > 0 && (
            <p className="text-xs text-texte-muted">Moyenne : {formatFCFA(moyenneCoutXAF)}</p>
          )}
        </div>
        {lignesCoutEleve.length === 0 ? (
          <p className="mt-4 text-sm text-texte-muted">
            Aucun appel IA rattaché à un élève sur 30 jours. Les appels mutualisés (filtrage vidéos) ne sont pas
            rattachés à un élève.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs text-texte-muted uppercase">
                  <th className="pb-2 font-semibold">Élève</th>
                  <th className="pb-2 font-semibold">Requêtes (30j)</th>
                  <th className="pb-2 font-semibold">Coût estimé</th>
                  <th className="pb-2 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lignesCoutEleve.map((l) => {
                  const aberrant = moyenneCoutXAF > 0 && l.coutXAF > moyenneCoutXAF * 2;
                  return (
                    <tr key={l.codeEleve} className={aberrant ? "bg-danger-light" : ""}>
                      <td className="py-2 font-serif font-semibold text-texte">{l.codeEleve}</td>
                      <td className="py-2 text-texte-muted">{l.requetes}</td>
                      <td className={`py-2 font-semibold ${aberrant ? "text-danger" : "text-texte"}`}>
                        {formatFCFA(l.coutXAF)}
                      </td>
                      <td className="py-2">
                        {aberrant ? (
                          <span className="text-xs font-bold text-danger">△ Aberrant</span>
                        ) : (
                          <span className="text-xs text-texte-muted">Normal</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-texte">Journal des appels</h2>
          <span className="text-xs text-texte-muted">{total.toLocaleString("fr-FR")} appel{total > 1 ? "s" : ""}</span>
        </div>
        {appels.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-fond px-4 py-12 text-center">
            <IconSparkles className="h-6 w-6 text-texte-muted" aria-hidden="true" />
            <p className="text-sm text-texte-muted">
              Aucun appel IA enregistré. Le journal se remplira dès que le mode IA réel sera activé.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-texte-muted uppercase">
                    <th className="pb-2 font-semibold">Date</th>
                    <th className="pb-2 font-semibold">Type</th>
                    <th className="pb-2 font-semibold">Modèle</th>
                    <th className="pb-2 font-semibold">Élève</th>
                    <th className="pb-2 font-semibold">Tokens (in / out)</th>
                    <th className="pb-2 font-semibold">Coût estimé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {appels.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2.5 text-texte-muted">
                        {a.date.toLocaleString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 text-texte">{LABELS_TYPE[a.typeUsage] ?? a.typeUsage}</td>
                      <td className="py-2.5 text-texte-muted">{LABELS_MODELE[a.modele] ?? a.modele}</td>
                      <td className="py-2.5 font-serif text-xs text-texte-muted">{a.eleve?.codeEleve ?? "—"}</td>
                      <td className="py-2.5 text-texte-muted">
                        {a.tokensInput.toLocaleString("fr-FR")} / {a.tokensOutput.toLocaleString("fr-FR")}
                      </td>
                      <td className="py-2.5 font-semibold text-texte">
                        {formatFCFA(Number(a.coutEstime) * USD_VERS_XAF)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} basePath="/admin/usage-ia" />
          </>
        )}
      </section>
    </main>
  );
}

function UsageTile({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-sm">
      <p className="text-xs text-texte-muted">{label}</p>
      <p className="mt-1 font-serif text-xl font-bold text-texte">{valeur}</p>
    </div>
  );
}
