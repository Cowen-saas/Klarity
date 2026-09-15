"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { IconCheckCircle, IconWarning } from "@/components/icons";

interface QuestionVue {
  id: string;
  enonce: string;
  choix: string[];
  notion: string | null;
  reponseEleve: string | null;
  correcte: boolean | null;
  bonneReponse: string | null;
  explication: string | null;
}

interface QuizPlayerProps {
  quizId: string;
  matiere: string;
  statutInitial: string;
  scoreInitial: number | null;
  questionsInitiales: QuestionVue[];
}

function messageResultat(score: number, total: number): string {
  const ratio = total === 0 ? 0 : score / total;
  if (ratio >= 0.8) return "Tu maîtrises bien cette notion. Continue comme ça !";
  if (ratio >= 0.5) return "Bon travail — encore quelques révisions et ce sera parfait.";
  return "Cette notion demande encore du travail. N'hésite pas à revoir le cours.";
}

/**
 * Prise de quiz interactive (maquette 10) — une question à la fois, feedback
 * immédiat après réponse, puis écran de résultat. Générique : sert aussi
 * bien au quiz journalier qu'au quiz ciblé (§2.1).
 */
export function QuizPlayer({ quizId, matiere, statutInitial, scoreInitial, questionsInitiales }: QuizPlayerProps) {
  const [questions, setQuestions] = useState(questionsInitiales);
  const premierNonRepondu = questions.findIndex((q) => q.reponseEleve == null);
  const [index, setIndex] = useState(premierNonRepondu === -1 ? 0 : premierNonRepondu);
  const [termine, setTermine] = useState(statutInitial === "TERMINE" || premierNonRepondu === -1);
  const [score, setScore] = useState(scoreInitial);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const question = questions[index];

  async function repondre(choix: string) {
    if (!question || question.reponseEleve != null) return;
    setEnCours(true);
    setErreur(null);
    try {
      const res = await apiFetch(`/api/eleve/quiz/${quizId}/repondre`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, reponse: choix }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.error ?? "Réponse impossible.");
        return;
      }
      setQuestions((qs) =>
        qs.map((q) =>
          q.id === question.id
            ? { ...q, reponseEleve: choix, correcte: data.question.correcte, bonneReponse: data.question.bonneReponse, explication: data.question.explication }
            : q
        )
      );
      if (data.quizTermine) {
        setScore(data.score);
        setTermine(true);
      }
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setEnCours(false);
    }
  }

  if (termine) {
    const total = questions.length;
    const scoreAffiche = score ?? questions.filter((q) => q.correcte).length;
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-light text-primary">
          <span className="text-xl font-extrabold">
            {scoreAffiche}/{total}
          </span>
        </div>
        <h1 className="mt-5 text-lg font-bold text-texte">Quiz terminé !</h1>
        <p className="mt-1 text-sm text-texte-muted">{messageResultat(scoreAffiche, total)}</p>
        <div className="mt-4 flex justify-center gap-1.5">
          {questions.map((q) => (
            <span key={q.id} className={`h-5 w-5 rounded ${q.correcte ? "bg-success" : "bg-danger"}`} aria-hidden="true" />
          ))}
        </div>
        <Link
          href="/eleve/lacunes"
          className="mt-6 block rounded-xl bg-primary py-3 text-sm font-bold text-white transition-colors hover:bg-primary-dark"
        >
          Voir mes lacunes
        </Link>
      </div>
    );
  }

  if (!question) return null;

  const dejaRepondue = question.reponseEleve != null;

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-sm sm:p-8">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-primary">
          Question {index + 1} / {questions.length}
        </span>
        <span className="text-texte-muted">{question.notion ?? matiere}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fond">
        <div className="h-full rounded-full bg-primary" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>

      <p className="mt-5 text-base font-bold text-texte">{question.enonce}</p>

      <div className="mt-4 space-y-2">
        {question.choix.map((c) => {
          const estBonneReponse = dejaRepondue && c === question.bonneReponse;
          const estChoisieEtFausse = dejaRepondue && c === question.reponseEleve && !question.correcte;
          return (
            <button
              key={c}
              type="button"
              onClick={() => repondre(c)}
              disabled={dejaRepondue || enCours}
              className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${
                estBonneReponse
                  ? "border-success bg-success-light text-texte"
                  : estChoisieEtFausse
                    ? "border-danger bg-danger-light text-texte"
                    : "border-border bg-surface text-texte disabled:opacity-60"
              }`}
            >
              {c}
              {estBonneReponse && <IconCheckCircle className="h-4 w-4 text-success" weight="fill" aria-hidden="true" />}
              {estChoisieEtFausse && <IconWarning className="h-4 w-4 text-danger" weight="fill" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {erreur && (
        <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-danger">
          <IconWarning className="h-4 w-4" weight="fill" aria-hidden="true" />
          {erreur}
        </p>
      )}

      {dejaRepondue && question.explication && (
        <p className={`mt-4 rounded-xl p-4 text-sm ${question.correcte ? "bg-success-light text-texte" : "bg-danger-light text-texte"}`}>
          {question.correcte ? "✓ " : "✗ "}
          {question.explication}
        </p>
      )}

      {dejaRepondue && (
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(i + 1, questions.length - 1))}
          className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white transition-colors hover:bg-primary-dark"
        >
          Question suivante
        </button>
      )}
    </div>
  );
}
