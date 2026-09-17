import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { QuizAujourdhui } from "@/components/eleve/QuizAujourdhui";

export const metadata: Metadata = {
  title: "Quiz du jour — Klarity",
};

function debutAujourdhui(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Hub du quiz journalier (§2.1, §4.3, §6.1, maquette 10). Si un quiz a déjà
 * été généré aujourd'hui, redirige directement vers l'écran de prise de
 * quiz générique (`/eleve/quiz/[id]`) ; sinon affiche l'état d'éligibilité
 * (générer / attendre / aucune lacune).
 */
export default async function QuizAujourdhuiPage() {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ELEVE") {
    redirect("/connexion?from=/eleve/quiz");
  }

  const eleveId = session.user.id;
  const quiz = await prisma.quiz.findFirst({
    where: { eleveId, origine: "JOURNALIER", dateGeneration: { gte: debutAujourdhui() } },
    select: { id: true },
  });
  if (quiz) {
    redirect(`/eleve/quiz/${quiz.id}`);
  }

  const nbLacunesActives = await prisma.lacune.count({ where: { eleveId, resolu: false } });

  return (
    <main className="mx-auto max-w-md px-6 py-8 sm:px-8">
      <QuizAujourdhui peutGenerer={nbLacunesActives > 0} />
    </main>
  );
}
