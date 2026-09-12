import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { obtenirTarifPremium } from "@/lib/payment/tarification";
import { PeriodeTarifaireManager } from "@/components/admin/PeriodeTarifaireManager";
import { PrixNormalManager } from "@/components/admin/PrixNormalManager";

export const metadata: Metadata = {
  title: "Paramètres — Admin Klarity",
  robots: { index: false, follow: false },
};

/**
 * Paramètres de la plateforme (§2.3) : le **prix Premium normal** (hors promo,
 * `ParametrePlateforme` clé `PRIX_NORMAL_PREMIUM`) et les **fenêtres tarifaires
 * promotionnelles** (`PeriodeTarifaire`, §2.4.1). Les deux étaient autrefois en
 * dur dans `src/lib/payment/tarification.ts` ; les deux sont désormais éditables
 * ici, avec effet immédiat (l'écran public `/abonnement` relit la base à chaque
 * rendu).
 */
export default async function AdminParametresPage() {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    redirect("/admin/connexion");
  }

  const maintenant = new Date();

  const [periodes, tarif] = await Promise.all([
    prisma.periodeTarifaire.findMany({
      orderBy: [{ dateDebut: "desc" }],
      select: { id: true, nom: true, dateDebut: true, dateFin: true, prixApplique: true, actif: true },
    }),
    obtenirTarifPremium(maintenant),
  ]);

  const periodesVue = periodes.map((p) => ({
    id: p.id,
    nom: p.nom,
    dateDebut: p.dateDebut.toISOString(),
    dateFin: p.dateFin.toISOString(),
    prixApplique: Number(p.prixApplique),
    actif: p.actif,
    couvreAujourdhui: p.dateDebut <= maintenant && p.dateFin >= maintenant,
  }));

  return (
    <main className="max-w-6xl px-6 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-texte">Paramètres</h1>
      <p className="mt-1 text-sm text-texte-muted">
        Prix Premium normal et fenêtres tarifaires promotionnelles (§2.4.1). Toute modification est prise en compte
        immédiatement sur l&apos;écran public de choix de formule.
      </p>

      <section className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-texte-muted uppercase">Tarif Premium appliqué aujourd&apos;hui</p>
            <p className="mt-1 font-serif text-2xl font-bold text-texte">
              {tarif.prix.toLocaleString("fr-FR")} FCFA <span className="text-sm font-normal text-texte-muted">/ mois</span>
            </p>
          </div>
          {tarif.enPromo && tarif.nomPeriode ? (
            <span className="rounded-full bg-danger-light px-3 py-1 text-xs font-bold text-danger">
              🎁 {tarif.nomPeriode} — {tarif.reduction.toLocaleString("fr-FR")} FCFA de réduction
            </span>
          ) : (
            <span className="rounded-full bg-fond px-3 py-1 text-xs font-semibold text-texte-muted">
              Tarif normal ({tarif.prixNormal.toLocaleString("fr-FR")} FCFA)
            </span>
          )}
        </div>
      </section>

      <div className="mt-6">
        <PrixNormalManager prixNormal={tarif.prixNormal} promoActive={tarif.enPromo ? { nom: tarif.nomPeriode, prix: tarif.prix } : null} />
      </div>

      <div className="mt-6">
        <PeriodeTarifaireManager periodes={periodesVue} prixNormal={tarif.prixNormal} />
      </div>
    </main>
  );
}
