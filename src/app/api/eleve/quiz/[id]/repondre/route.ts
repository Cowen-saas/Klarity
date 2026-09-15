import { NextResponse } from "next/server";
import { z } from "zod";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

/**
 * Réponse à une question de quiz (§2.1, §4.3). `Lacune.niveauMaitrise` est
 * recalculé ici de façon **déterministe** (ratio réponses correctes/total
 * sur la notion, cf. CLAUDE.md/v1.12) — jamais un appel IA. Seuil de
 * résolution (`Lacune.resolu = true`) aligné sur le seuil "bonne maîtrise"
 * déjà utilisé dans l'écran "Mes lacunes" (≥70%, cf. `MesLacunes.tsx`) —
 * choix explicite pour rester cohérent entre les deux écrans, pas une valeur
 * du CDC.
 *
 * IDOR (réf. sécurité §5) : le quiz doit appartenir à l'élève connecté.
 * Idempotent : une question déjà répondue renvoie son résultat existant
 * sans jamais recompter la lacune une seconde fois pour la même réponse.
 */
const SEUIL_RESOLUTION = 70;

const bodySchema = z.object({
  questionId: z.string().min(1),
  reponse: z.string().min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await exigerRole("ELEVE");
  if (!garde.ok) return garde.response;
  const eleveId = garde.session.user.id;

  const { id: quizId } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const quiz = await prisma.quiz.findFirst({ where: { id: quizId, eleveId }, select: { id: true } });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz introuvable." }, { status: 404 });
  }

  const question = await prisma.quizQuestion.findFirst({ where: { id: parsed.data.questionId, quizId } });
  if (!question) {
    return NextResponse.json({ error: "Question introuvable." }, { status: 404 });
  }

  if (question.reponseEleve != null) {
    // Déjà répondue — renvoie le résultat existant sans rien recalculer (idempotence).
    return NextResponse.json({
      question: { correcte: question.correcte, bonneReponse: question.bonneReponse, explication: question.explication },
    });
  }

  const correcte = parsed.data.reponse === question.bonneReponse;

  await prisma.$transaction(async (tx) => {
    await tx.quizQuestion.update({
      where: { id: question.id },
      data: { reponseEleve: parsed.data.reponse, correcte },
    });

    if (question.lacuneId) {
      // La mise à jour ci-dessus est déjà visible dans cette même transaction
      // (lecture de sa propre écriture) — historique inclut donc déjà cette réponse,
      // pas de comptage séparé à ajouter.
      const historique = await tx.quizQuestion.findMany({
        where: { lacuneId: question.lacuneId, reponseEleve: { not: null } },
        select: { correcte: true },
      });
      const total = historique.length;
      const correctes = historique.filter((h) => h.correcte).length;
      const niveauMaitrise = total === 0 ? 0 : Math.round((100 * correctes) / total);

      await tx.lacune.update({
        where: { id: question.lacuneId },
        data: { niveauMaitrise, resolu: niveauMaitrise >= SEUIL_RESOLUTION },
      });
    }
  });

  const toutesRepondues = await prisma.quizQuestion.count({ where: { quizId, reponseEleve: null } });
  let quizTermine = false;
  let score: number | null = null;
  if (toutesRepondues === 0) {
    score = await prisma.quizQuestion.count({ where: { quizId, correcte: true } });
    await prisma.quiz.update({ where: { id: quizId }, data: { statut: "TERMINE", score } });
    quizTermine = true;
  }

  const questionMaj = await prisma.quizQuestion.findUniqueOrThrow({ where: { id: question.id } });
  return NextResponse.json({
    question: { correcte: questionMaj.correcte, bonneReponse: questionMaj.bonneReponse, explication: questionMaj.explication },
    quizTermine,
    score,
  });
}
