import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BarChart } from "@/components/ui/BarChart";

const NOMS_MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

// Taux d'affichage uniquement — UsageIA.coutEstime reste stocké en USD (devise de
// facturation Anthropic réelle, cf. src/lib/ai/pricing.ts), converti ici en FCFA
// (devise produit, §2.4) pour l'admin. Taux indicatif approximatif, pas une source
// de change réelle — à revoir si un vrai suivi financier multi-devises est construit.
const USD_VERS_XAF = 610;

const STATUT_PAIEMENT: Record<string, { label: string; classes: string }> = {
  REUSSI: { label: "Confirmé", classes: "bg-success-light text-success" },
  EN_ATTENTE: { label: "En attente", classes: "bg-accent-light text-texte" },
  ECHEC: { label: "Échoué", classes: "bg-danger-light text-danger" },
  REMBOURSE: { label: "Remboursé", classes: "bg-fond text-texte-muted" },
};

const LABELS_EVENEMENT: Record<string, string> = {
  LOGIN_FAIL: "Échec de connexion admin",
  OTP_FAIL: "Code OTP invalide",
  PIN_FAIL: "Code secret élève invalide",
  IDOR_BLOCKED: "Accès refusé à une ressource d'un autre compte",
  WEBHOOK_INVALID: "Webhook reçu avec signature invalide",
  COMPTE_INACTIF_DETECTE: "Compte détecté inactif",
  COMPTE_ANONYMISE_AUTO: "Compte anonymisé automatiquement",
  COMPTE_ANONYMISE_MANUEL: "Compte anonymisé manuellement",
};

function formatFCFA(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    redirect("/connexion");
  }

  const maintenant = new Date();
  const debutAujourdhui = new Date();
  debutAujourdhui.setHours(0, 0, 0, 0);
  const ilYa7j = new Date(maintenant.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ilYa14j = new Date(maintenant.getTime() - 14 * 24 * 60 * 60 * 1000);
  const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  const ilYa24h = new Date(maintenant.getTime() - 24 * 60 * 60 * 1000);
  const ilYa30j = new Date(maintenant.getTime() - 30 * 24 * 60 * 60 * 1000);
  const huitMoisAvant = new Date(maintenant.getFullYear(), maintenant.getMonth() - 7, 1);

  const [
    elevesInscrits,
    parentsInscrits,
    actifsAujourdhui,
    nouveaux7j,
    nouveauxPrec7j,
    elevesCeMois,
    parentsCeMois,
    paiementsConfirmes,
    abonnementsParPlan,
    epreuvesRecentes,
    usageIA30j,
    connexionsEchouees24h,
    webhooksInvalides24h,
    accesNonAutorises24h,
    derniersEvenements,
    datesExamens,
    exemplesCorrection,
    correctionsSignalees,
    paiementsRecents,
  ] = await Promise.all([
    prisma.eleve.count(),
    prisma.parent.count(),
    prisma.eleve.count({ where: { derniereActiviteLe: { gte: debutAujourdhui } } }),
    prisma.eleve.count({ where: { createdAt: { gte: ilYa7j } } }),
    prisma.eleve.count({ where: { createdAt: { gte: ilYa14j, lt: ilYa7j } } }),
    prisma.eleve.count({ where: { createdAt: { gte: debutMois } } }),
    prisma.parent.count({ where: { createdAt: { gte: debutMois } } }),
    prisma.paiement.findMany({
      where: { statut: "REUSSI", datePaiement: { gte: huitMoisAvant } },
      select: { montant: true, datePaiement: true },
    }),
    prisma.abonnement.groupBy({ by: ["plan"], _count: { plan: true } }),
    prisma.epreuve.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { titre: true, classe: true, filiere: true, createdAt: true, matiere: { select: { nom: true } } },
    }),
    prisma.usageIA.groupBy({
      by: ["eleveId"],
      where: { date: { gte: ilYa30j }, eleveId: { not: null } },
      _sum: { coutEstime: true },
      _count: { _all: true },
    }),
    prisma.auditLogSecurite.count({
      where: { typeEvenement: { in: ["LOGIN_FAIL", "OTP_FAIL", "PIN_FAIL"] }, createdAt: { gte: ilYa24h } },
    }),
    prisma.webhookLog.count({ where: { signatureValide: false, createdAt: { gte: ilYa24h } } }),
    prisma.auditLogSecurite.count({ where: { typeEvenement: "IDOR_BLOCKED", createdAt: { gte: ilYa24h } } }),
    prisma.auditLogSecurite.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.dateExamen.findMany({ orderBy: { dateExamen: "asc" }, take: 3 }),
    prisma.exempleCorrection.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { typeExercice: true, matiere: { select: { nom: true } } },
    }),
    prisma.correctionDetail.findMany({
      where: { signalee: true },
      orderBy: { dateSignalement: "desc" },
      take: 5,
      select: {
        id: true,
        motifSignalement: true,
        dateSignalement: true,
        eleve: { select: { codeEleve: true } },
        epreuve: { select: { titre: true } },
        matiere: { select: { nom: true } },
      },
    }),
    prisma.paiement.findMany({
      orderBy: { datePaiement: "desc" },
      take: 4,
      select: {
        montant: true,
        methode: true,
        statut: true,
        datePaiement: true,
        abonnement: { select: { eleve: { select: { codeEleve: true } } } },
      },
    }),
  ]);

  // Récupère les eleveId réellement utilisés pour joindre le codeEleve au monitoring usage IA.
  const eleveIdsUsage = usageIA30j.map((u) => u.eleveId).filter((id): id is string => id !== null);
  const elevesUsage = eleveIdsUsage.length
    ? await prisma.eleve.findMany({ where: { id: { in: eleveIdsUsage } }, select: { id: true, codeEleve: true } })
    : [];
  const codeParEleveId = new Map(elevesUsage.map((e) => [e.id, e.codeEleve]));

  const lignesUsageIA = usageIA30j
    .map((u) => ({
      codeEleve: codeParEleveId.get(u.eleveId as string) ?? "—",
      requetes: u._count._all,
      coutXAF: Number(u._sum.coutEstime ?? 0) * USD_VERS_XAF,
    }))
    .sort((a, b) => b.coutXAF - a.coutXAF);
  const moyenneCoutXAF =
    lignesUsageIA.length > 0 ? lignesUsageIA.reduce((s, l) => s + l.coutXAF, 0) / lignesUsageIA.length : 0;

  const donneesCA = Array.from({ length: 8 }, (_, i) => {
    const mois = new Date(huitMoisAvant.getFullYear(), huitMoisAvant.getMonth() + i, 1);
    const finMois = new Date(mois.getFullYear(), mois.getMonth() + 1, 1);
    const total = paiementsConfirmes
      .filter((p) => p.datePaiement >= mois && p.datePaiement < finMois)
      .reduce((s, p) => s + Number(p.montant), 0);
    return { label: NOMS_MOIS[mois.getMonth()], value: total };
  });
  const chiffreAffairesTotal = donneesCA.reduce((s, d) => s + d.value, 0);

  const totalAbonnements = abonnementsParPlan.reduce((s, a) => s + a._count.plan, 0);
  const premiumCount = abonnementsParPlan.find((a) => a.plan === "PREMIUM")?._count.plan ?? 0;
  const gratuitCount = abonnementsParPlan.find((a) => a.plan === "GRATUIT")?._count.plan ?? 0;

  const pourcentageNouveaux =
    nouveauxPrec7j > 0 ? Math.round(((nouveaux7j - nouveauxPrec7j) / nouveauxPrec7j) * 100) : null;

  return (
    <main className="max-w-6xl px-6 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-texte">Vue d&apos;ensemble</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Élèves inscrits" valeur={elevesInscrits.toLocaleString("fr-FR")} delta={`▲ ${elevesCeMois} ce mois`} />
        <StatTile label="Parents inscrits" valeur={parentsInscrits.toLocaleString("fr-FR")} delta={`▲ ${parentsCeMois} ce mois`} />
        <StatTile label="Actifs aujourd'hui" valeur={actifsAujourdhui.toLocaleString("fr-FR")} delta="aujourd'hui" />
        <StatTile
          label="Nouveaux (7j)"
          valeur={nouveaux7j.toLocaleString("fr-FR")}
          delta={pourcentageNouveaux !== null ? `${pourcentageNouveaux >= 0 ? "▲" : "▼"} ${Math.abs(pourcentageNouveaux)}%` : "—"}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-texte">Chiffre d&apos;affaires</h2>
            <p className="font-serif text-2xl font-bold text-primary">{formatFCFA(chiffreAffairesTotal)}</p>
          </div>
          <div className="mt-4">
            <BarChart data={donneesCA} valueFormatter={formatFCFA} emptyMessage="Aucun paiement confirmé pour l'instant." />
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
        </section>
      </div>

      <section className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-texte">Épreuves récemment ajoutées</h2>
          <Link
            href="/admin/epreuves"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            + Ajouter une épreuve
          </Link>
        </div>
        {epreuvesRecentes.length === 0 ? (
          <p className="mt-4 text-sm text-texte-muted">Aucune épreuve dans la banque pour l&apos;instant.</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {epreuvesRecentes.map((e, i) => (
              <div key={i} className="grid grid-cols-4 gap-3 py-3 text-sm">
                <p className="font-semibold text-texte">{e.titre}</p>
                <p className="text-texte-muted">
                  {e.classe}
                  {e.filiere ? ` ${e.filiere}` : ""}
                </p>
                <p className="text-texte-muted">{e.matiere.nom}</p>
                <p className="text-right text-texte-muted">{e.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 text-xs font-bold tracking-wide text-texte-muted uppercase">Pilotage &amp; sécurité</p>

      <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <h2 className="text-base font-bold text-texte">Monitoring usage IA — coût par utilisateur</h2>
            <p className="text-xs text-texte-muted">Moyenne : {formatFCFA(moyenneCoutXAF)} / mois</p>
          </div>
          {lignesUsageIA.length === 0 ? (
            <p className="mt-4 text-sm text-texte-muted">Aucun usage IA sur les 30 derniers jours.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-texte-muted uppercase">
                  <th className="pb-2 font-semibold">Élève</th>
                  <th className="pb-2 font-semibold">Requêtes (30j)</th>
                  <th className="pb-2 font-semibold">Coût estimé</th>
                  <th className="pb-2 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lignesUsageIA.map((l) => {
                  const aberrant = moyenneCoutXAF > 0 && l.coutXAF > moyenneCoutXAF * 2;
                  return (
                    <tr key={l.codeEleve} className={aberrant ? "bg-danger-light" : ""}>
                      <td className="py-2 font-semibold text-texte">{l.codeEleve}</td>
                      <td className="py-2 text-texte-muted">{l.requetes}</td>
                      <td className={`py-2 font-semibold ${aberrant ? "text-danger" : "text-texte"}`}>{formatFCFA(l.coutXAF)}</td>
                      <td className="py-2">{aberrant ? <span className="text-xs font-bold text-danger">△ Aberrant</span> : <span className="text-xs text-texte-muted">Normal</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-base font-bold text-texte">Observabilité sécurité</h2>
          <div className="mt-4 space-y-2">
            <SecuriteLigne label="Connexions échouées (24h)" valeur={connexionsEchouees24h} niveau={connexionsEchouees24h > 0 ? "attention" : "ok"} />
            <SecuriteLigne label="Webhooks invalides (24h)" valeur={webhooksInvalides24h} niveau={webhooksInvalides24h > 0 ? "critique" : "ok"} />
            <SecuriteLigne label="Accès non autorisés détectés" valeur={accesNonAutorises24h} niveau={accesNonAutorises24h > 0 ? "critique" : "ok"} />
          </div>
          <p className="mt-5 text-xs font-bold tracking-wide text-texte-muted uppercase">Derniers événements</p>
          {derniersEvenements.length === 0 ? (
            <p className="mt-2 text-sm text-texte-muted">Aucun événement récent.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm text-texte">
              {derniersEvenements.map((ev) => (
                <li key={ev.id}>
                  <span className="font-semibold">{LABELS_EVENEMENT[ev.typeEvenement] ?? ev.typeEvenement}</span> —{" "}
                  {ev.createdAt.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-texte">Dates d&apos;examens</h2>
            <Link
              href="/admin/dates-examens"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              + Ajouter
            </Link>
          </div>
          {datesExamens.length === 0 ? (
            <p className="mt-4 text-sm text-texte-muted">Aucune date d&apos;examen renseignée.</p>
          ) : (
            <div className="mt-3 divide-y divide-border">
              {datesExamens.map((d) => (
                <div key={d.id} className="py-3">
                  <p className="text-sm font-semibold text-texte">{d.typeExamen}</p>
                  <p className="text-xs text-texte-muted">
                    {d.dateExamen
                      ? d.dateExamen.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
                      : (d.datePeriodeEstimee ?? "Date estimée non renseignée")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-texte">Exemples de correction — Français / Philo</h2>
            <button type="button" disabled className="cursor-not-allowed rounded-xl bg-primary/40 px-4 py-2 text-sm font-semibold text-white">
              + Ajouter une copie
            </button>
          </div>
          {exemplesCorrection.length === 0 ? (
            <p className="mt-4 text-sm text-texte-muted">Aucun exemple de correction pour l&apos;instant.</p>
          ) : (
            <div className="mt-3 divide-y divide-border">
              {exemplesCorrection.map((ex, i) => (
                <div key={i} className="py-3">
                  <p className="text-sm font-semibold text-texte">
                    {ex.matiere.nom} · {ex.typeExercice}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <p className="mt-8 text-xs font-bold tracking-wide text-texte-muted uppercase">Corrections signalées</p>

      <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-texte">Corrections contestées</h2>
            {correctionsSignalees.length > 0 && (
              <span className="rounded-full bg-danger-light px-3 py-1 text-xs font-bold text-danger">
                {correctionsSignalees.length} en attente
              </span>
            )}
          </div>
          {correctionsSignalees.length === 0 ? (
            <p className="mt-4 text-sm text-texte-muted">Aucune correction signalée pour l&apos;instant.</p>
          ) : (
            <div className="mt-3 divide-y divide-border">
              {correctionsSignalees.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/corrections-signalees?id=${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 text-sm transition-colors hover:bg-fond"
                >
                  <p className="font-semibold text-texte">{c.eleve.codeEleve}</p>
                  <p className="text-texte-muted">
                    {c.epreuve.titre} — {c.matiere.nom}
                  </p>
                  <p className="text-texte-muted">{c.motifSignalement}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-surface p-6 text-center shadow-sm">
          <p className="text-sm text-texte-muted">Ouvre une correction signalée pour la traiter et forcer une nouvelle note.</p>
          <Link href="/admin/corrections-signalees" className="text-sm font-semibold text-primary hover:underline">
            Voir toutes les corrections signalées
          </Link>
        </section>
      </div>

      <section className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
        <h2 className="text-base font-bold text-texte">Journal des paiements récents</h2>
        {paiementsRecents.length === 0 ? (
          <p className="mt-4 text-sm text-texte-muted">Aucun paiement pour l&apos;instant.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-texte-muted uppercase">
                <th className="pb-2 font-semibold">Élève</th>
                <th className="pb-2 font-semibold">Montant</th>
                <th className="pb-2 font-semibold">Méthode</th>
                <th className="pb-2 font-semibold">Statut</th>
                <th className="pb-2 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paiementsRecents.map((p, i) => {
                const statut = STATUT_PAIEMENT[p.statut] ?? { label: p.statut, classes: "bg-fond text-texte-muted" };
                return (
                  <tr key={i}>
                    <td className="py-2 font-semibold text-texte">{p.abonnement.eleve.codeEleve}</td>
                    <td className="py-2 text-texte">{formatFCFA(Number(p.montant))}</td>
                    <td className="py-2 text-texte-muted">{p.methode}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statut.classes}`}>{statut.label}</span>
                    </td>
                    <td className="py-2 text-texte-muted">
                      {p.datePaiement.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function StatTile({ label, valeur, delta }: { label: string; valeur: string; delta: string }) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-sm">
      <p className="text-xs text-texte-muted">{label}</p>
      <p className="mt-1 font-serif text-2xl font-bold text-texte">{valeur}</p>
      <p className="mt-1 text-xs font-semibold text-success">{delta}</p>
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

function SecuriteLigne({ label, valeur, niveau }: { label: string; valeur: number; niveau: "ok" | "attention" | "critique" }) {
  const styles =
    niveau === "critique" ? "bg-danger-light text-danger" : niveau === "attention" ? "bg-accent-light text-texte" : "bg-fond text-texte-muted";
  return (
    <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold ${styles}`}>
      <p>{label}</p>
      <p>{valeur}</p>
    </div>
  );
}
