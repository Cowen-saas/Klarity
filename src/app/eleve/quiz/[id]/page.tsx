import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { QuizPlayer } from "@/components/eleve/QuizPlayer";

export const metadata: Metadata = {
  title: "Quiz — Klarity",
};

/**
 * Écran générique de prise de quiz (maquette 10, §2.1, §4.3) — utilisé aussi
 * bien pour le quiz journalier que pour un quiz ciblé (`?lacuneId=` côté
 * "Mes lacunes"). IDOR : le quiz doit appartenir à l'élève connecté
 * (réf. sécurité §5).
 *
 * La bonne réponse et l'explication ne sont envoyées au client que pour les
 * questions déjà répondues — jamais exposées à l'avance dans le HTML/props
 * initiaux (même règle que la route API `GET /api/eleve/quiz/[id]`).
 */
export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ELEVE") {
    redirect("/connexion?from=/eleve/quiz");
  }

  const { id } = await params;
  const quiz = await prisma.quiz.findFirst({
    where: { id, eleveId: session.user.id },
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
  if (!quiz) notFound();

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

  return (
    <main className="mx-auto max-w-lg px-6 py-8 sm:px-8">
      <QuizPlayer
        quizId={quiz.id}
        matiere={quiz.matiere.nom}
        statutInitial={quiz.statut}
        scoreInitial={quiz.score}
        questionsInitiales={questions}
      />
    </main>
  );
}
