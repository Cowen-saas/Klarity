import { NextResponse } from "next/server";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

/**
 * Lecture d'un quiz (journalier ou ciblé) — écran de prise de quiz (maquette
 * 10). IDOR : filtré par `eleveId` de la session, jamais un id de quiz
 * arbitraire (réf. sécurité §5).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await exigerRole("ELEVE");
  if (!garde.ok) return garde.response;

  const { id } = await params;
  const quiz = await prisma.quiz.findFirst({
    where: { id, eleveId: garde.session.user.id },
    include: {
      matiere: { select: { nom: true } },
      questions: {
        select: {
          id: true,
          enonce: true,
          choixJson: true,
          reponseEleve: true,
          correcte: true,
          explication: true,
          bonneReponse: true,
          lacune: { select: { notion: true } },
        },
      },
    },
  });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz introuvable." }, { status: 404 });
  }

  // La bonne réponse et l'explication ne sont exposées qu'une fois la question répondue —
  // sinon l'élève pourrait les lire dans la réponse réseau avant de répondre.
  const questions = quiz.questions.map((q) => ({
    id: q.id,
    enonce: q.enonce,
    choix: q.choixJson as string[],
    notion: q.lacune?.notion ?? null,
    reponseEleve: q.reponseEleve,
    correcte: q.correcte,
    bonneReponse: q.reponseEleve != null ? q.bonneReponse : null,
    explication: q.reponseEleve != null ? q.explication : null,
  }));

  return NextResponse.json({
    quiz: { id: quiz.id, statut: quiz.statut, score: quiz.score, matiere: quiz.matiere.nom, origine: quiz.origine, questions },
  });
}
