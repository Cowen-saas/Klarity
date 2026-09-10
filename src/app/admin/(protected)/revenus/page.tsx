import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BarChart } from "@/components/ui/BarChart";
import { BandeauModeTest } from "@/components/admin/BandeauModeTest";
import { paiementsSontReels } from "@/lib/payment";

export const metadata: Metadata = {
  title: "Revenus — Admin Klarity",
  robots: { index: false, follow: false },
};

const NOMS_MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function formatFCFA(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

/**
 * Tableau de bord financier (§2.3, §2.4). MRR = somme des `prixApplique` figés
 * des abonnements ACTIF (jamais recalculé a posteriori, §2.4.1). CA mensuel =
 * paiements `REUSSI`. Accès global ADMIN légitime — défense par le gate ADMIN
 * (middleware + layout + contrôle en tête). Tant que `paiementsSontReels()`
 * est faux (mock, ou NotchPay avec une clé `pk_test_…`), les montants ne sont
 * pas de vrai chiffre d'affaires : bandeau explicite.
 */
export default async function AdminRevenusPage() {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    redirect("/admin/connexion");
  }

  const modePaiement = process.env.PAYMENT_MODE ?? "mock";

  const maintenant = new Date();
  const huitMoisAvant = new Date(maintenant.getFullYear(), maintenant.getMonth() - 7, 1);
  const trenteJoursAvant = new Date(maintenant.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dansTrenteJours = new Date(maintenant.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    mrrAgg,
    caTotalAgg,
    abonnementsParStatut,
    abonnementsParPlan,
    paiementsConfirmes,
    caTrenteJours,
    renouvellementsProches,
  ] = await Promise.all([
    prisma.abonnement.aggregate({ where: { statut: "ACTIF" }, _sum: { prixApplique: true }, _count: { _all: true } }),
    prisma.paiement.aggregate({ where: { statut: "REUSSI" }, _sum: { montant: true } }),
    prisma.abonnement.groupBy({ by: ["statut"], _count: { _all: true } }),
    prisma.abonnement.groupBy({ by: ["plan"], _count: { _all: true } }),
    prisma.paiement.findMany({
      where: { statut: "REUSSI", datePaiement: { gte: huitMoisAvant } },
      select: { montant: true, datePaiement: true },
    }),
    prisma.paiement.aggregate({
      where: { statut: "REUSSI", datePaiement: { gte: trenteJoursAvant } },
      _sum: { montant: true },
    }),
    prisma.abonnement.count({
      where: { statut: "ACTIF", dateProchainRenouvellement: { gte: maintenant, lte: dansTrenteJours } },
    }),
  ]);

  const mrr = Number(mrrAgg._sum.prixApplique ?? 0);
  const abonnementsActifs = mrrAgg._count._all;
  const caTotal = Number(caTotalAgg._sum.montant ?? 0);

  const comptesStatut = new Map(abonnementsParStatut.map((r) => [r.statut, r._count._all]));
  const actifs = comptesStatut.get("ACTIF") ?? 0;
  const expires = comptesStatut.get("EXPIRE") ?? 0;
  const baseChurn = actifs + expires;
  const tauxChurn = baseChurn > 0 ? Math.round((expires / baseChurn) * 100) : 0;

  const totalAbonnements = abonnementsParPlan.reduce((s, a) => s + a._count._all, 0);
  const premiumCount = abonnementsParPlan.find((a) => a.plan === "PREMIUM")?._count._all ?? 0;
  const gratuitCount = abonnementsParPlan.find((a) => a.plan === "GRATUIT")?._count._all ?? 0;

  const donneesCA = Array.from({ length: 8 }, (_, i) => {
    const mois = new Date(huitMoisAvant.getFullYear(), huitMoisAvant.getMonth() + i, 1);
    const finMois = new Date(mois.getFullYear(), mois.getMonth() + 1, 1);
    const total = paiementsConfirmes
      .filter((p) => p.datePaiement >= mois && p.datePaiement < finMois)
      .reduce((s, p) => s + Number(p.montant), 0);
    return { label: NOMS_MOIS[mois.getMonth()], value: total };
  });

  return (
    <main className="max-w-6xl px-6 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-texte">Revenus</h1>
      <p className="mt-1 text-sm text-texte-muted">
        Revenu mensuel récurrent, chiffre d&apos;affaires encaissé et rétention des abonnements Premium (§2.4).
      </p>

      {!paiementsSontReels() && <BandeauModeTest mode={modePaiement} sujet="Montants" />}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RevenuTile label="MRR (Premium actifs)" valeur={formatFCFA(mrr)} note={`${abonnementsActifs} abonnement${abonnementsActifs > 1 ? "s" : ""}`} />
        <RevenuTile label="CA encaissé (total)" valeur={formatFCFA(caTotal)} note="paiements confirmés" />
        <RevenuTile label="CA sur 30 j" valeur={formatFCFA(Number(caTrenteJours._sum.montant ?? 0))} note="glissant" />
        <RevenuTile
          label="Taux de churn"
          valeur={`${tauxChurn} %`}
          note={baseChurn > 0 ? `${expires} expiré${expires > 1 ? "s" : ""} / ${baseChurn}` : "pas encore de base"}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-texte">Chiffre d&apos;affaires mensuel</h2>
            <p className="font-serif text-2xl font-bold text-primary">
              {formatFCFA(donneesCA.reduce((s, d) => s + d.value, 0))}
            </p>
          </div>
          <div className="mt-4">
            <BarChart data={donneesCA} valueFormatter={formatFCFA} emptyMessage="Aucun paiement confirmé sur la période." />
          </div>
        </section>

        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-base font-bold text-texte">Répartition des abonnements</h2>
          {totalAbonnements === 0 ? (
            <p className="mt-4 text-sm text-texte-muted">Pas encore de données.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <RepartitionBar label="Premium" pourcentage={Math.round((premiumCount / totalAbonnements) * 100)} />
              <RepartitionBar label="Gratuit" pourcentage={Math.round((gratuitCount / totalAbonnements) * 100)} muted />
            </div>
          )}
          <p className="mt-5 text-xs font-bold tracking-wide text-texte-muted uppercase">Renouvellements sous 30 j</p>
          <p className="mt-1 font-serif text-2xl font-bold text-texte">{renouvellementsProches}</p>
        </section>
      </div>

      <section className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
        <h2 className="text-base font-bold text-texte">Méthode de calcul</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-texte-muted">
          <li>
            <strong className="text-texte">MRR</strong> — somme des <code className="font-mono text-xs">prixApplique</code>{" "}
            des abonnements <code className="font-mono text-xs">ACTIF</code>, figés au paiement et jamais recalculés
            (§2.4.1).
          </li>
          <li>
            <strong className="text-texte">CA encaissé</strong> — somme des <code className="font-mono text-xs">montant</code>{" "}
            des paiements <code className="font-mono text-xs">REUSSI</code>.
          </li>
          <li>
            <strong className="text-texte">Churn</strong> — abonnements <code className="font-mono text-xs">EXPIRE</code> ÷
            (ACTIF + EXPIRE). Indicateur brut, non annualisé.
          </li>
        </ul>
      </section>
    </main>
  );
}

function RevenuTile({ label, valeur, note }: { label: string; valeur: string; note: string }) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-sm">
      <p className="text-xs text-texte-muted">{label}</p>
      <p className="mt-1 font-serif text-xl font-bold text-texte">{valeur}</p>
      <p className="mt-1 text-xs text-texte-muted">{note}</p>
    </div>
  );
}

function RepartitionBar({ label, pourcentage, muted }: { label: string; pourcentage: number; muted?: boolean }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <p className="text-texte">{label}</p>
        <p className="font-semibold text-texte">{pourcentage}%</p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-fond">
        <div className={`h-full rounded-full ${muted ? "bg-border" : "bg-primary"}`} style={{ width: `${pourcentage}%` }} />
      </div>
    </div>
  );
}
