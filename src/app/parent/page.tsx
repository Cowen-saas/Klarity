import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EnfantSelector } from "@/components/parent/EnfantSelector";
import { BarChart } from "@/components/ui/BarChart";

const CLASSE_LABELS: Record<string, string> = {
  TROISIEME: "3e",
  PREMIERE: "1ère",
  TERMINALE: "Terminale",
};

const NOMS_MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

// Aligné sur le seuil de notification d'inactivité (§2.9, rétention) — pas de
// bandeau tant qu'on n'est pas réellement dans cette fenêtre.
const SEUIL_INACTIVITE_JOURS = 60;

function formatDuree(secondes: number): string {
  const heures = Math.floor(secondes / 3600);
  const minutes = Math.round((secondes % 3600) / 60);
  return `${heures}h${minutes.toString().padStart(2, "0")}`;
}

export default async function ParentDashboardPage({ searchParams }: PageProps<"/parent">) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "PARENT") {
    redirect("/connexion");
  }

  const parentId = session.user.id;

  const [liens, parent] = await Promise.all([
    prisma.parentEleveLink.findMany({
      where: { parentId },
      include: {
        eleve: { select: { id: true, nom: true, classe: true, filiere: true, derniereActiviteLe: true } },
      },
      orderBy: { dateLiaison: "asc" },
    }),
    prisma.parent.findUnique({ where: { id: parentId }, select: { dernierEleveConsulteId: true } }),
  ]);

  if (liens.length === 0) {
    return (
      <main className="max-w-3xl px-6 py-10 sm:px-8">
        <h1 className="text-2xl font-bold text-texte">Aucun enfant lié pour l&apos;instant</h1>
        <p className="mt-2 text-sm text-texte-muted">
          Utilise le code élève et le numéro de téléphone communiqués par ton enfant pour te connecter — le lien se
          crée automatiquement dès la première vérification par SMS.
        </p>
      </main>
    );
  }

  const { eleve: eleveParam } = await searchParams;
  const idParam = Array.isArray(eleveParam) ? eleveParam[0] : eleveParam;
  const idsLies = new Set(liens.map((l) => l.eleveId));

  // IDOR : ne jamais faire confiance à ?eleve= sans vérifier l'appartenance du lien.
  let selectedId = idParam && idsLies.has(idParam) ? idParam : null;
  if (!selectedId) {
    selectedId =
      parent?.dernierEleveConsulteId && idsLies.has(parent.dernierEleveConsulteId)
        ? parent.dernierEleveConsulteId
        : liens[0].eleveId;
  }

  const lien = liens.find((l) => l.eleveId === selectedId)!;
  const eleve = lien.eleve;
  const classeLabel = CLASSE_LABELS[eleve.classe] ?? eleve.classe;

  const inactifDepuisMs = eleve.derniereActiviteLe ? Date.now() - eleve.derniereActiviteLe.getTime() : null;
  const montrerBandeauInactivite =
    inactifDepuisMs !== null && inactifDepuisMs > SEUIL_INACTIVITE_JOURS * 24 * 60 * 60 * 1000;

  const debutSemaine = new Date();
  debutSemaine.setDate(debutSemaine.getDate() - 7);
  const sixMoisAvant = new Date();
  sixMoisAvant.setMonth(sixMoisAvant.getMonth() - 5);
  sixMoisAvant.setDate(1);
  sixMoisAvant.setHours(0, 0, 0, 0);

  const [corrections, lacunes, sessionsSemaine, prochaineEcheance, historique] = await Promise.all([
    prisma.correctionDetail.findMany({
      where: { eleveId: eleve.id },
      select: { note: true, createdAt: true },
    }),
    prisma.lacune.findMany({
      where: { eleveId: eleve.id, resolu: false },
      orderBy: { niveauMaitrise: "asc" },
      select: { notion: true, niveauMaitrise: true },
    }),
    prisma.sessionActivite.findMany({
      where: { eleveId: eleve.id, dateDebut: { gte: debutSemaine } },
      select: { dureeSecondes: true },
    }),
    prisma.dateExamen.findFirst({
      where: { OR: [{ dateExamen: { gte: new Date() } }, { dateExamen: null }] },
      orderBy: { dateExamen: "asc" },
    }),
    prisma.correctionDetail.findMany({
      where: { eleveId: eleve.id },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { note: true, createdAt: true, epreuve: { select: { titre: true } }, matiere: { select: { nom: true } } },
    }),
  ]);

  const notesValides = corrections.map((c) => c.note).filter((n): n is number => n !== null);
  const moyenneGenerale = notesValides.length > 0 ? notesValides.reduce((s, n) => s + n, 0) / notesValides.length : null;
  const progressionGenerale = moyenneGenerale !== null ? Math.round((moyenneGenerale / 20) * 100) : null;
  const tempsCetteSemaine = sessionsSemaine.reduce((s, x) => s + (x.dureeSecondes ?? 0), 0);

  const donneesGraphique = Array.from({ length: 6 }, (_, i) => {
    const mois = new Date(sixMoisAvant);
    mois.setMonth(mois.getMonth() + i);
    const finMois = new Date(mois.getFullYear(), mois.getMonth() + 1, 1);
    const notesMois = corrections
      .filter((c) => c.createdAt >= mois && c.createdAt < finMois && c.note !== null)
      .map((c) => c.note as number);
    const moyenne = notesMois.length > 0 ? notesMois.reduce((s, n) => s + n, 0) / notesMois.length : 0;
    return { label: NOMS_MOIS[mois.getMonth()], value: Math.round(moyenne * 10) / 10 };
  });

  const lacunesCritiques = lacunes.filter((l) => l.niveauMaitrise < 30);
  const lacunesASurveiller = lacunes.filter((l) => l.niveauMaitrise >= 30 && l.niveauMaitrise < 60);
  const lacunePrioritaire = lacunes[0];

  const joursAvantEcheance = prochaineEcheance?.dateExamen
    ? Math.max(0, Math.ceil((prochaineEcheance.dateExamen.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  return (
    <main className="max-w-5xl px-6 py-8 sm:px-8">
      {montrerBandeauInactivite && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-light px-4 py-3">
          <p className="text-sm text-texte">
            <strong>{eleve.nom}</strong> n&apos;a pas utilisé Klarity depuis plusieurs semaines.
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <EnfantSelector enfants={liens.map((l) => ({ id: l.eleveId, nom: l.eleve.nom }))} selectedId={selectedId} />
          <span className="text-sm text-texte-muted">
            {classeLabel}
            {eleve.filiere ? ` · Série ${eleve.filiere}` : ""}
          </span>
        </div>
        <span className="rounded-full bg-fond px-3 py-1.5 text-xs font-semibold text-texte-muted">
          Pas encore de tendance
        </span>
      </div>

      <section className="rounded-2xl bg-surface p-6 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">Synthèse de la semaine</p>
        <p className="mt-2 text-sm text-texte">
          Pas encore de données pour {eleve.nom} — la synthèse apparaîtra dès la première épreuve corrigée ou le
          premier échange avec le Tuteur IA.
        </p>
      </section>

      <section className="mt-6 rounded-2xl bg-[#134a6b] p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-white/70 uppercase">🗓️ Échéance à venir</p>
            {joursAvantEcheance !== null ? (
              <p className="mt-1 text-xl font-bold">
                {prochaineEcheance?.typeExamen} dans {joursAvantEcheance} jour{joursAvantEcheance > 1 ? "s" : ""}
              </p>
            ) : (
              <p className="mt-1 text-base">Aucune date d&apos;examen renseignée pour l&apos;instant.</p>
            )}
          </div>
          <div className="text-right text-sm text-white/80">
            {classeLabel}
            {eleve.filiere ? ` ${eleve.filiere}` : ""}
          </div>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Progression générale", valeur: progressionGenerale !== null ? `${progressionGenerale}%` : "—" },
          { label: "Épreuves réalisées", valeur: corrections.length > 0 ? String(corrections.length) : "—" },
          { label: "Temps cette semaine", valeur: tempsCetteSemaine > 0 ? formatDuree(tempsCetteSemaine) : "—" },
          { label: "Moyenne générale", valeur: moyenneGenerale !== null ? `${moyenneGenerale.toFixed(1).replace(".", ",")}/20` : "—" },
        ].map((tuile) => (
          <div key={tuile.label} className="rounded-2xl bg-surface p-5 shadow-sm">
            <p className="text-xs text-texte-muted">{tuile.label}</p>
            <p className="mt-2 text-xl font-bold text-texte">{tuile.valeur}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-base font-bold text-texte">Évolution des performances</h2>
          <div className="mt-4">
            <BarChart data={donneesGraphique} valueFormatter={(v) => `${v}/20`} emptyMessage="Pas encore de données à afficher." />
          </div>
        </section>
        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-base font-bold text-texte">Alertes intelligentes</h2>
          {lacunesCritiques.length === 0 && lacunesASurveiller.length === 0 ? (
            <p className="mt-3 text-sm text-texte-muted">
              Pas encore d&apos;alerte — elles apparaîtront dès que {eleve.nom} aura une activité à analyser.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {lacunesCritiques.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-bold tracking-wide text-danger uppercase">Critique</p>
                  {lacunesCritiques.map((l) => (
                    <p key={l.notion} className="rounded-lg bg-danger-light px-3 py-2 text-sm text-texte">
                      ● Lacune importante en {l.notion} ({l.niveauMaitrise}% de maîtrise).
                    </p>
                  ))}
                </div>
              )}
              {lacunesASurveiller.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-bold tracking-wide text-accent uppercase">À surveiller</p>
                  {lacunesASurveiller.map((l) => (
                    <p key={l.notion} className="rounded-lg bg-accent-light px-3 py-2 text-sm text-texte">
                      ⚠ {l.notion} — {l.niveauMaitrise}% de maîtrise.
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-base font-bold text-texte">Historique des épreuves corrigées</h2>
          {historique.length === 0 ? (
            <p className="mt-3 text-sm text-texte-muted">Aucune épreuve corrigée pour l&apos;instant.</p>
          ) : (
            <div className="mt-3 divide-y divide-border">
              {historique.map((h, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-semibold text-texte">{h.epreuve.titre}</p>
                    <p className="text-xs text-texte-muted">
                      {h.matiere.nom} · {h.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                    </p>
                  </div>
                  <p className="font-serif text-lg font-bold text-texte">{h.note ?? "—"}/20</p>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="rounded-2xl bg-primary-light p-6">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">Suggestion d&apos;action</p>
          {lacunePrioritaire ? (
            <>
              <p className="mt-2 text-sm font-bold text-texte">
                {lacunePrioritaire.notion} — {lacunePrioritaire.niveauMaitrise}% de maîtrise
              </p>
              <p className="mt-2 text-sm text-texte">
                Encouragez {eleve.nom} à retravailler cette notion cette semaine avec le Tuteur IA.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-texte">Pas encore de suggestion — reviens ici après la première lacune détectée.</p>
          )}
        </section>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-xl border-2 border-border bg-surface px-4 py-2.5 text-sm font-semibold text-texte-muted opacity-60"
        >
          ↓ Exporter le rapport mensuel (PDF) — Bientôt
        </button>
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs text-texte-muted">
        Nous ne montrons jamais le contenu des conversations ni l&apos;activité minute par minute de votre enfant —
        uniquement sa progression et ses résultats.
      </p>
    </main>
  );
}
