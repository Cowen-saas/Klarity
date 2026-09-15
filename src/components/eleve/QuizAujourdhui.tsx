"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { IconPencil, IconCheckCircle, IconWarning } from "@/components/icons";

const INTERVALLE_MS = 2000;

/**
 * Écran d'accueil du quiz du jour quand aucun n'existe encore aujourd'hui
 * (le cron n'est pas encore passé, ou c'est la première fois). Génération à
 * la demande : enqueue puis sondage, jamais d'appel IA inline (§3).
 */
export function QuizAujourdhui({ peutGenerer }: { peutGenerer: boolean }) {
  const router = useRouter();
  const [enAttente, setEnAttente] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!enAttente) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch("/api/eleve/quiz/aujourdhui");
        if (!res.ok) return;
        const data = await res.json();
        if (data.quiz) {
          router.push(`/eleve/quiz/${data.quiz.id}`);
        }
      } catch {
        // silencieux — la prochaine itération réessaiera
      }
    }, INTERVALLE_MS);
    return () => clearInterval(interval);
  }, [enAttente, router]);

  async function generer() {
    setErreur(null);
    try {
      const res = await apiFetch("/api/eleve/quiz/aujourdhui", { method: "POST" });
      const data = await res.json();
      if (res.status === 202) {
        setEnAttente(true);
        return;
      }
      if (data.quiz) {
        router.push(`/eleve/quiz/${data.quiz.id}`);
        return;
      }
      setErreur(data.error ?? "Génération impossible.");
    } catch {
      setErreur("Impossible de contacter le serveur.");
    }
  }

  if (!peutGenerer) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-sm">
        <IconCheckCircle className="mx-auto h-8 w-8 text-success" weight="fill" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-bold text-texte">Pas de quiz aujourd&apos;hui</h1>
        <p className="mt-1 text-sm text-texte-muted">
          Aucune lacune active pour l&apos;instant — continue comme ça ! Le quiz du jour apparaîtra dès qu&apos;une lacune sera détectée.
        </p>
      </div>
    );
  }

  if (enAttente) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-primary-light border-t-primary" />
        <h1 className="mt-5 text-lg font-bold text-texte">Préparation de ton quiz...</h1>
        <p className="mt-1 text-sm text-texte-muted">Ça prend juste quelques secondes.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface p-8 text-center shadow-sm">
      <IconPencil className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
      <h1 className="mt-4 text-lg font-bold text-texte">Ton quiz du jour t&apos;attend</h1>
      <p className="mt-1 text-sm text-texte-muted">Généré à partir de tes lacunes actives, pour t&apos;aider à progresser.</p>
      {erreur && (
        <p role="alert" className="mt-3 flex items-center justify-center gap-1.5 text-sm text-danger">
          <IconWarning className="h-4 w-4" weight="fill" aria-hidden="true" />
          {erreur}
        </p>
      )}
      <button
        type="button"
        onClick={generer}
        className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white transition-colors hover:bg-primary-dark"
      >
        Générer mon quiz du jour
      </button>
    </div>
  );
}
