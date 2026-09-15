import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai";
import { estimerCoutIA } from "@/lib/ai/pricing";

/**
 * Génération réelle d'un quiz (§2.1, §4.3, §6.1) — exécutée uniquement par
 * le worker BullMQ (`src/worker/index.ts`), jamais par une route `app` (§3).
 * Deux origines (`Quiz.origine`, v1.11) :
 *
 *  - JOURNALIER : automatique, une fois par jour et par élève, ciblée sur la
 *    matière où l'élève a le plus de lacunes actives (nombre de lacunes,
 *    puis niveau de maîtrise moyen le plus bas en cas d'égalité).
 *  - CIBLE : déclenchée manuellement depuis "Mes lacunes" sur une notion
 *    précise (§2.1) — un seul quiz, une seule lacune.
 */

interface LacuneCible {
  id: string;
  notion: string;
  niveauMaitrise: number;
}

async function creerQuiz(params: {
  eleveId: string;
  matiereId: string;
  matiereNom: string;
  lacunes: LacuneCible[];
  origine: "JOURNALIER" | "CIBLE";
  lacuneCibleId?: string;
}): Promise<string | null> {
  const genere = await getAIProvider().genererQuiz(params.lacunes, params.matiereNom);
  if (genere.questions.length === 0) return null;

  const quizId = await prisma.$transaction(async (tx) => {
    const quiz = await tx.quiz.create({
      data: {
        eleveId: params.eleveId,
        matiereId: params.matiereId,
        origine: params.origine,
        lacuneCibleId: params.lacuneCibleId,
        statut: "EN_COURS",
      },
    });
    await tx.quizQuestion.createMany({
      data: genere.questions.map((q) => ({
        quizId: quiz.id,
        lacuneId: q.lacuneId,
        enonce: q.enonce,
        choixJson: q.choix as unknown as Prisma.InputJsonValue,
        bonneReponse: q.bonneReponse,
        explication: q.explication,
      })),
    });
    await tx.usageIA.create({
      data: {
        eleveId: params.eleveId,
        matiereId: params.matiereId,
        typeUsage: "QUIZ",
        modele: "HAIKU",
        tokensInput: genere.tokensInput,
        tokensOutput: genere.tokensOutput,
        coutEstime: estimerCoutIA("HAIKU", genere.tokensInput, genere.tokensOutput),
      },
    });
    return quiz.id;
  });

  return quizId;
}

function debutAujourdhui(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Quiz journalier pour un élève — no-op si déjà généré aujourd'hui ou aucune lacune active. */
export async function genererQuizJournalierPourEleve(eleveId: string): Promise<string | null> {
  const dejaAujourdhui = await prisma.quiz.findFirst({
    where: { eleveId, origine: "JOURNALIER", dateGeneration: { gte: debutAujourdhui() } },
    select: { id: true },
  });
  if (dejaAujourdhui) return dejaAujourdhui.id;

  const lacunes = await prisma.lacune.findMany({
    where: { eleveId, resolu: false },
    select: { id: true, notion: true, niveauMaitrise: true, matiereId: true },
  });
  if (lacunes.length === 0) return null;

  const parMatiere = new Map<string, LacuneCible[]>();
  for (const l of lacunes) {
    const liste = parMatiere.get(l.matiereId) ?? [];
    liste.push({ id: l.id, notion: l.notion, niveauMaitrise: l.niveauMaitrise });
    parMatiere.set(l.matiereId, liste);
  }
  const [matiereIdCible, lacunesCibles] = Array.from(parMatiere.entries()).sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    const moyA = a[1].reduce((s, l) => s + l.niveauMaitrise, 0) / a[1].length;
    const moyB = b[1].reduce((s, l) => s + l.niveauMaitrise, 0) / b[1].length;
    return moyA - moyB;
  })[0];

  const matiere = await prisma.matiere.findUniqueOrThrow({ where: { id: matiereIdCible }, select: { nom: true } });
  return creerQuiz({ eleveId, matiereId: matiereIdCible, matiereNom: matiere.nom, lacunes: lacunesCibles, origine: "JOURNALIER" });
}

/** Quiz ciblé sur une lacune précise — déclenché depuis "Mes lacunes" (§2.1). */
export async function genererQuizCiblePourEleve(eleveId: string, lacuneId: string): Promise<string | null> {
  const lacune = await prisma.lacune.findFirst({
    where: { id: lacuneId, eleveId, resolu: false },
    include: { matiere: { select: { id: true, nom: true } } },
  });
  if (!lacune) return null;

  return creerQuiz({
    eleveId,
    matiereId: lacune.matiere.id,
    matiereNom: lacune.matiere.nom,
    lacunes: [{ id: lacune.id, notion: lacune.notion, niveauMaitrise: lacune.niveauMaitrise }],
    origine: "CIBLE",
    lacuneCibleId: lacune.id,
  });
}

/** Cron quotidien (§5.5-style job, worker) — tous les élèves ayant au moins une lacune active. */
export async function genererQuizJournalierPourTousLesEleves(): Promise<{ generes: number; ignores: number; erreurs: number }> {
  const eleveIds = await prisma.lacune.findMany({
    where: { resolu: false },
    distinct: ["eleveId"],
    select: { eleveId: true },
  });

  let generes = 0;
  let ignores = 0;
  let erreurs = 0;
  for (const { eleveId } of eleveIds) {
    try {
      const id = await genererQuizJournalierPourEleve(eleveId);
      if (id) generes++;
      else ignores++;
    } catch (err) {
      erreurs++;
      console.error(`[quiz] échec génération journalière pour élève ${eleveId}`, err);
    }
  }
  return { generes, ignores, erreurs };
}
