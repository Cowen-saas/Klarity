import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BarChart } from "@/components/ui/BarChart";
import { IconClock } from "@/components/icons";

export const metadata: Metadata = {
  title: "Temps passé — Klarity Famille",
  robots: { index: false, follow: false },
};

const CLASSE_LABELS: Record<string, string> = {
  TROISIEME: "3e",
  PREMIERE: "1ère",
  TERMINALE: "Terminale",
};

const JOURS_COURTS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
const NB_JOURS = 14;
const NB_SEMAINES = 8;

function formatDuree(secondes: number): string {
  if (secondes <= 0) return "0 min";
  if (secondes < 60) return "< 1 min";
  const heures = Math.floor(secondes / 3600);
  const minutes = Math.round((secondes % 3600) / 60);
  if (heures === 0) return `${minutes} min`;
  return `${heures} h ${minutes.toString().padStart(2, "0")}`;
}

/** Minuit local du jour de `d`. */
function debutJour(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Lundi 00:00 de la semaine de `d`. */
function debutSemaine(d: Date): Date {
  const x = debutJour(d);
  const decalage = (x.getDay() + 6) % 7; // 0 = lundi
  x.setDate(x.getDate() - decalage);
  return x;
}

/**
 * Temps réellement passé sur la plateforme par l'enfant lié (§2.2, brief
 * fondateur : « le temps passé sur la plateforme par jour »). Lecture seule des
 * lignes `SessionActivite` (canal WEB), produites par `ActivityTracker` sur des
 * signaux d'activité réels — jamais un minuteur aveugle.
 *
 * IDOR : réservé PARENT ; l'enfant sélectionné (`?eleve=`) doit avoir un
 * `ParentEleveLink` vérifié vers ce parent — re-vérifié à chaque requête,
 * jamais fié à l'UI.
 */
export default async function ParentTempsPassePage({
  searchParams,
}: {
  searchParams: Promise<{ eleve?: string }>;
}) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "PARENT") {
    redirect("/connexion");
  }

  const liens = await prisma.parentEleveLink.findMany({
    where: { parentId: session.user.id },
    orderBy: { dateLiaison: "asc" },
    select: { eleve: { select: { id: true, nom: true, classe: true, filiere: true } } },
  });

  if (liens.length === 0) {
    return (
      <main className="max-w-3xl px-6 py-10 sm:px-8">
        <h1 className="text-2xl font-bold text-texte">Temps passé</h1>
        <p className="mt-2 text-sm text-texte-muted">Aucun enfant lié à ton compte pour l&apos;instant.</p>
      </main>
    );
  }

  const { eleve: eleveParam } = await searchParams;
  const idsLies = new Set(liens.map((l) => l.eleve.id));
  const selectedId = eleveParam && idsLies.has(eleveParam) ? eleveParam : liens[0].eleve.id;
  const enfant = liens.find((l) => l.eleve.id === selectedId)!.eleve;

  const maintenant = new Date();
  const debutFenetre = debutSemaine(maintenant);
  debutFenetre.setDate(debutFenetre.getDate() - 7 * (NB_SEMAINES - 1));
  // On élargit au plus large des deux fenêtres (jours vs semaines).
  const borneJours = debutJour(maintenant);
  borneJours.setDate(borneJours.getDate() - (NB_JOURS - 1));
  const borne = debutFenetre < borneJours ? debutFenetre : borneJours;

  const sessions = await prisma.sessionActivite.findMany({
    where: { eleveId: enfant.id, dateDebut: { gte: borne } },
    select: { dateDebut: true, dureeSecondes: true },
    orderBy: { dateDebut: "asc" },
  });

  const totalSecondes = (predicat: (d: Date) => boolean) =>
    sessions.filter((s) => predicat(s.dateDebut)).reduce((acc, s) => acc + (s.dureeSecondes ?? 0), 0);

  // Par jour (14 derniers jours)
  const parJour = Array.from({ length: NB_JOURS }, (_, i) => {
    const jour = debutJour(maintenant);
    jour.setDate(jour.getDate() - (NB_JOURS - 1 - i));
    const finJour = new Date(jour);
    finJour.setDate(finJour.getDate() + 1);
    const secondes = totalSecondes((d) => d >= jour && d < finJour);
    return { label: `${JOURS_COURTS[jour.getDay()]} ${jour.getDate()}`, value: secondes };
  });

  // Par semaine (8 dernières semaines, lundi → dimanche)
  const parSemaine = Array.from({ length: NB_SEMAINES }, (_, i) => {
    const lundi = debutSemaine(maintenant);
    lundi.setDate(lundi.getDate() - 7 * (NB_SEMAINES - 1 - i));
    const lundiSuivant = new Date(lundi);
    lundiSuivant.setDate(lundiSuivant.getDate() + 7);
    const secondes = totalSecondes((d) => d >= lundi && d < lundiSuivant);
    return { label: `${lundi.getDate()}/${lundi.getMonth() + 1}`, value: secondes };
  });

  const il7j = new Date(maintenant.getTime() - 7 * 24 * 60 * 60 * 1000);
  const il30j = new Date(maintenant.getTime() - 30 * 24 * 60 * 60 * 1000);
  const secondes7j = totalSecondes((d) => d >= il7j);
  const secondes30j = totalSecondes((d) => d >= il30j);

  const lundiCourant = debutSemaine(maintenant);
  const lundiPrecedent = new Date(lundiCourant);
  lundiPrecedent.setDate(lundiPrecedent.getDate() - 7);
  const secondesCetteSemaine = totalSecondes((d) => d >= lundiCourant);
  const secondesSemainePrec = totalSecondes((d) => d >= lundiPrecedent && d < lundiCourant);
  const deltaSemaine =
    secondesSemainePrec > 0
      ? Math.round(((secondesCetteSemaine - secondesSemainePrec) / secondesSemainePrec) * 100)
      : null;

  const joursActifs30j = new Set(
    sessions.filter((s) => s.dateDebut >= il30j).map((s) => debutJour(s.dateDebut).getTime()),
  ).size;
  const moyenneParJourActif = joursActifs30j > 0 ? Math.round(secondes30j / joursActifs30j) : 0;

  const aucuneDonnee = sessions.length === 0;
  const classeLabel = `${CLASSE_LABELS[enfant.classe] ?? enfant.classe}${enfant.filiere ? ` · Série ${enfant.filiere}` : ""}`;

  return (
    <main className="max-w-5xl px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-texte">Temps passé</h1>
        <span className="text-sm text-texte-muted">{classeLabel}</span>
      </div>
      <p className="mt-1 text-sm text-texte-muted">
        Temps réellement passé par {enfant.nom} sur la plateforme web, par jour et par semaine.
      </p>

      {liens.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2" role="radiogroup" aria-label="Choisir un enfant">
          {liens.map((l) => {
            const actif = l.eleve.id === selectedId;
            return (
              <a
                key={l.eleve.id}
                href={`/parent/temps-passe?eleve=${l.eleve.id}`}
                role="radio"
                aria-checked={actif}
                className={`rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors ${
                  actif ? "border-primary bg-primary-light text-primary" : "border-border bg-surface text-texte"
                }`}
              >
                {l.eleve.nom}
              </a>
            );
          })}
        </div>
      )}

      {aucuneDonnee ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-16 text-center shadow-sm">
          <IconClock className="h-8 w-8 text-texte-muted" aria-hidden="true" />
          <p className="max-w-md text-sm text-texte-muted">
            Pas encore de temps enregistré pour {enfant.nom}. Le compteur démarre dès la prochaine session sur la
            plateforme.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <TempsTile label="Cette semaine" valeur={formatDuree(secondesCetteSemaine)} note={
              deltaSemaine === null
                ? "première semaine active"
                : `${deltaSemaine >= 0 ? "▲" : "▼"} ${Math.abs(deltaSemaine)} % vs semaine dernière`
            } />
            <TempsTile label="7 derniers jours" valeur={formatDuree(secondes7j)} note="glissant" />
            <TempsTile label="30 derniers jours" valeur={formatDuree(secondes30j)} note={`${joursActifs30j} jour${joursActifs30j > 1 ? "s" : ""} actif${joursActifs30j > 1 ? "s" : ""}`} />
            <TempsTile label="Moyenne / jour actif" valeur={formatDuree(moyenneParJourActif)} note="sur 30 j" />
          </div>

          <section className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
            <h2 className="text-base font-bold text-texte">Par jour — 14 derniers jours</h2>
            <div className="mt-4">
              <BarChart data={parJour} valueFormatter={formatDuree} emptyMessage="Aucune activité sur la période." />
            </div>
          </section>

          <section className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
            <h2 className="text-base font-bold text-texte">Par semaine — 8 dernières semaines</h2>
            <p className="mt-1 text-xs text-texte-muted">Semaine du lundi au dimanche.</p>
            <div className="mt-4">
              <BarChart data={parSemaine} valueFormatter={formatDuree} emptyMessage="Aucune activité sur la période." />
            </div>
          </section>
        </>
      )}

      <p className="mt-6 flex items-start gap-2 text-xs text-texte-muted">
        Nous ne montrons jamais le contenu des conversations ni l&apos;activité minute par minute de votre enfant —
        uniquement le temps total passé sur la plateforme.
      </p>
    </main>
  );
}

function TempsTile({ label, valeur, note }: { label: string; valeur: string; note: string }) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-sm">
      <p className="text-xs text-texte-muted">{label}</p>
      <p className="mt-1 font-serif text-xl font-bold text-texte">{valeur}</p>
      <p className="mt-1 text-xs text-texte-muted">{note}</p>
    </div>
  );
}
