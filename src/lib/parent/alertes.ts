import { prisma } from "@/lib/prisma";

/**
 * Alertes intelligentes côté parent (§2.2.2) — règles calculées à la volée,
 * **jamais un appel IA** (comme `Lacune.niveauMaitrise`, §4.3). Trois
 * niveaux, chacun avec sa règle exacte du CDC :
 *
 *  - CRITIQUE : lacune active persistante ≥ 21 jours (`Lacune.dateDetection`).
 *  - À SURVEILLER : baisse de moyenne mensuelle par matière (mois en cours
 *    vs précédent), ou baisse de temps passé ≥ 20% sur la semaine (semaine
 *    en cours vs précédente).
 *  - INFO : matière en progression (moyenne mensuelle stable ou en hausse),
 *    ou quiz complétés cette semaine.
 *
 * Remplace la logique simplifiée qui existait avant cette passe dans
 * `/parent` (seuils de `niveauMaitrise` bruts, sans rapport avec les règles
 * ci-dessus) — utilisée maintenant par la vue d'ensemble ET l'écran
 * Progression, pour ne jamais avoir deux définitions différentes d'« alerte »
 * dans l'app.
 */
export interface Alerte {
  texte: string;
}

export interface AlertesEleve {
  critiques: Alerte[];
  aSurveiller: Alerte[];
  info: Alerte[];
}

const SEUIL_PERSISTANCE_JOURS = 21;
const SEUIL_BAISSE_TEMPS_RATIO = 0.8; // baisse ≥ 20%

function debutMois(decalage: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() + decalage);
  return d;
}

/** Fenêtre glissante (pas une semaine calendaire) — même convention que "temps cette semaine" déjà utilisée ailleurs. */
function ilYaJours(jours: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - jours);
  return d;
}

export async function calculerAlertes(eleveId: string): Promise<AlertesEleve> {
  const seuilPersistance = new Date(Date.now() - SEUIL_PERSISTANCE_JOURS * 24 * 60 * 60 * 1000);

  const debutMoisCourant = debutMois(0);
  const debutMoisPrecedent = debutMois(-1);

  const debutSemaineCourante = ilYaJours(7);
  const debutSemainePrecedente = ilYaJours(14);

  const [lacunesPersistantes, notesMoisCourant, notesMoisPrecedent, sessionsSemaineCourante, sessionsSemainePrecedente, quizTerminesSemaine] =
    await Promise.all([
      prisma.lacune.findMany({
        where: { eleveId, resolu: false, dateDetection: { lte: seuilPersistance } },
        select: { notion: true },
      }),
      prisma.correctionDetail.findMany({
        where: { eleveId, createdAt: { gte: debutMoisCourant }, note: { not: null } },
        select: { note: true, matiere: { select: { nom: true } } },
      }),
      prisma.correctionDetail.findMany({
        where: { eleveId, createdAt: { gte: debutMoisPrecedent, lt: debutMoisCourant }, note: { not: null } },
        select: { note: true, matiere: { select: { nom: true } } },
      }),
      prisma.sessionActivite.findMany({
        where: { eleveId, dateDebut: { gte: debutSemaineCourante } },
        select: { dureeSecondes: true },
      }),
      prisma.sessionActivite.findMany({
        where: { eleveId, dateDebut: { gte: debutSemainePrecedente, lt: debutSemaineCourante } },
        select: { dureeSecondes: true },
      }),
      prisma.quiz.count({ where: { eleveId, statut: "TERMINE", dateGeneration: { gte: debutSemaineCourante } } }),
    ]);

  const critiques: Alerte[] = lacunesPersistantes.map((l) => ({
    texte: `Lacune persistante en ${l.notion} depuis plus de ${SEUIL_PERSISTANCE_JOURS} jours.`,
  }));

  const aSurveiller: Alerte[] = [];
  const info: Alerte[] = [];

  const moyenneParMatiere = (notes: { note: number | null; matiere: { nom: string } }[]) => {
    const parMatiere = new Map<string, number[]>();
    for (const n of notes) {
      if (n.note === null) continue;
      const liste = parMatiere.get(n.matiere.nom) ?? [];
      liste.push(n.note);
      parMatiere.set(n.matiere.nom, liste);
    }
    const moyennes = new Map<string, number>();
    for (const [matiere, valeurs] of parMatiere) {
      moyennes.set(matiere, valeurs.reduce((s, v) => s + v, 0) / valeurs.length);
    }
    return moyennes;
  };

  const moyennesCourantes = moyenneParMatiere(notesMoisCourant);
  const moyennesPrecedentes = moyenneParMatiere(notesMoisPrecedent);

  for (const [matiere, moyenneCourante] of moyennesCourantes) {
    const moyennePrecedente = moyennesPrecedentes.get(matiere);
    if (moyennePrecedente === undefined) continue;
    if (moyenneCourante < moyennePrecedente) {
      aSurveiller.push({ texte: `Baisse de moyenne en ${matiere} ce mois-ci (${moyenneCourante.toFixed(1)}/20 contre ${moyennePrecedente.toFixed(1)}/20 le mois précédent).` });
    } else {
      info.push({ texte: `Progression stable ou en hausse en ${matiere} ce mois-ci.` });
    }
  }

  const tempsCourant = sessionsSemaineCourante.reduce((s, x) => s + (x.dureeSecondes ?? 0), 0);
  const tempsPrecedent = sessionsSemainePrecedente.reduce((s, x) => s + (x.dureeSecondes ?? 0), 0);
  if (tempsPrecedent > 0 && tempsCourant < tempsPrecedent * SEUIL_BAISSE_TEMPS_RATIO) {
    const baissePct = Math.round((1 - tempsCourant / tempsPrecedent) * 100);
    aSurveiller.push({ texte: `Temps passé en baisse de ${baissePct}% cette semaine.` });
  }

  if (quizTerminesSemaine > 0) {
    info.push({ texte: `${quizTerminesSemaine} quiz complété${quizTerminesSemaine > 1 ? "s" : ""} cette semaine.` });
  }

  return { critiques, aSurveiller, info };
}
