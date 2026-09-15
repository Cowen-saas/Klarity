"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { IconRobot, IconCheckCircle, IconWarning, IconFlag, IconClose, IconBulb } from "@/components/icons";

type Motif = "LECTURE_ILLISIBLE" | "BAREME_INCORRECT" | "AUTRE";

const MOTIFS: { value: Motif; label: string }[] = [
  { value: "LECTURE_ILLISIBLE", label: "Lecture illisible" },
  { value: "BAREME_INCORRECT", label: "Barème mal appliqué" },
  { value: "AUTRE", label: "Autre" },
];

interface CorrectionVue {
  id: string;
  note: number | null;
  pointsForts: string[];
  pointsManques: { notion: string; detail: string }[];
  feedbackDetaille: string;
  signalee: boolean;
}

interface ResultatCorrectionProps {
  epreuveId: string;
  titre: string;
  matiere: string;
  classeLabel: string;
  anneeScolaire: string;
  correction: CorrectionVue;
}

/**
 * Résultat de correction détaillée (maquette 08, §2.1, §4.3). Adapté au
 * modèle de données réel de `CorrectionDetail` (`pointsForts: string[]`,
 * `pointsManques: {notion, detail}[]`, `feedbackDetaille`) plutôt qu'au
 * découpage question-par-question de la maquette ("Question 4", "Ta réponse"
 * / "Réponse correcte") : ce niveau de détail par sous-question n'existe pas
 * dans le schéma (adapté aux corrections rédigées/à barème global, pas
 * seulement aux exercices à réponse unique) — signalé explicitement à
 * l'utilisateur plutôt que de redessiner le schéma pour coller littéralement
 * à la maquette (cf. docs/PROGRESS.md).
 */
export function ResultatCorrection({ epreuveId, titre, matiere, classeLabel, anneeScolaire, correction }: ResultatCorrectionProps) {
  const [signalementOuvert, setSignalementOuvert] = useState(false);
  const [dejaSignalee, setDejaSignalee] = useState(correction.signalee);

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full bg-primary-light text-primary">
            <span className="text-2xl font-extrabold leading-none">
              {correction.note != null ? correction.note : "—"}
            </span>
            <span className="text-[11px] font-semibold">/ 20</span>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-primary uppercase">
              <IconRobot className="h-3.5 w-3.5" aria-hidden="true" />
              Corrigé par l&apos;IA
            </p>
            <h1 className="mt-0.5 text-lg font-bold text-texte">
              {titre} — {matiere}
            </h1>
            <p className="mt-0.5 text-xs text-texte-muted">
              {classeLabel} · {anneeScolaire}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/eleve/epreuves/${epreuveId}/correction?nouvelleTentative=1`}
            className="rounded-xl border-2 border-border bg-surface px-4 py-2 text-sm font-semibold text-texte transition-colors hover:border-primary/40"
          >
            Recommencer l&apos;épreuve
          </Link>
          {dejaSignalee ? (
            <span className="text-sm font-semibold text-texte-muted">Correction signalée</span>
          ) : (
            <button
              type="button"
              onClick={() => setSignalementOuvert(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-texte-muted underline hover:text-primary"
            >
              <IconFlag className="h-4 w-4" aria-hidden="true" />
              Signaler cette correction
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 border-t border-border pt-6 sm:grid-cols-2">
        <div className="rounded-xl bg-success-light p-4">
          <p className="text-2xl font-extrabold text-success">{correction.pointsForts.length}</p>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
            <IconCheckCircle className="h-4 w-4" weight="fill" aria-hidden="true" />
            Points forts
          </p>
        </div>
        <div className="rounded-xl bg-accent-light p-4">
          <p className="text-2xl font-extrabold text-accent">{correction.pointsManques.length}</p>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-accent">
            <IconBulb className="h-4 w-4" weight="fill" aria-hidden="true" />
            Points à travailler
          </p>
        </div>
      </div>

      {correction.pointsForts.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-texte">Ce qui est réussi</h2>
          <ul className="mt-2 space-y-1.5">
            {correction.pointsForts.map((pf, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-texte-muted">
                <IconCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" weight="fill" aria-hidden="true" />
                {pf}
              </li>
            ))}
          </ul>
        </div>
      )}

      {correction.pointsManques.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-texte">Détail des points à travailler</h2>
          <div className="mt-3 space-y-3">
            {correction.pointsManques.map((pm, i) => (
              <div key={i} className="rounded-xl border border-border p-4">
                <p className="text-sm font-bold text-texte">{pm.notion}</p>
                <p className="mt-2 rounded-lg bg-fond p-3 text-sm text-texte-muted">💡 {pm.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-border pt-6">
        <h2 className="text-sm font-bold text-texte">Retour détaillé</h2>
        <p className="mt-2 text-sm whitespace-pre-line text-texte-muted">{correction.feedbackDetaille}</p>
      </div>

      {signalementOuvert && (
        <SignalerModal
          correctionId={correction.id}
          onFerme={() => setSignalementOuvert(false)}
          onEnvoye={() => {
            setDejaSignalee(true);
            setSignalementOuvert(false);
          }}
        />
      )}
    </div>
  );
}

function SignalerModal({
  correctionId,
  onFerme,
  onEnvoye,
}: {
  correctionId: string;
  onFerme: () => void;
  onEnvoye: () => void;
}) {
  const [motif, setMotif] = useState<Motif>("LECTURE_ILLISIBLE");
  const [commentaire, setCommentaire] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer() {
    setEnCours(true);
    setErreur(null);
    try {
      const res = await apiFetch(`/api/eleve/corrections/${correctionId}/signaler`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motif, commentaire: commentaire.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErreur(data.error ?? "Envoi impossible.");
        return;
      }
      onEnvoye();
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4"
      onClick={onFerme}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signaler-titre"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-lg"
      >
        <div className="flex items-start justify-between">
          <h2 id="signaler-titre" className="text-base font-bold text-texte">
            Signaler cette correction
          </h2>
          <button type="button" onClick={onFerme} aria-label="Fermer" className="text-texte-muted hover:text-texte">
            <IconClose className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-sm text-texte-muted">Un membre de l&apos;équipe pédagogique va vérifier cette copie.</p>

        <fieldset className="mt-4 space-y-2">
          <legend className="mb-1 text-sm font-semibold text-texte">Motif</legend>
          {MOTIFS.map((m) => (
            <label
              key={m.value}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                motif === m.value ? "border-primary bg-primary-light text-primary" : "border-border text-texte hover:border-primary/40"
              }`}
            >
              <input type="radio" name="motif" checked={motif === m.value} onChange={() => setMotif(m.value)} className="sr-only" />
              {m.label}
            </label>
          ))}
        </fieldset>

        <label htmlFor="commentaire-signalement" className="mt-4 block text-sm font-semibold text-texte">
          Commentaire (optionnel)
        </label>
        <textarea
          id="commentaire-signalement"
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          placeholder="Précise ce qui te semble incorrect…"
          rows={3}
          className="mt-1.5 w-full rounded-xl border-2 border-border bg-surface px-4 py-2.5 text-sm text-texte outline-none transition-colors focus:border-primary"
        />

        {erreur && (
          <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-danger">
            <IconWarning className="h-4 w-4" weight="fill" aria-hidden="true" />
            {erreur}
          </p>
        )}

        <button
          type="button"
          onClick={envoyer}
          disabled={enCours}
          className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {enCours ? "Envoi…" : "Envoyer le signalement"}
        </button>
      </div>
    </div>
  );
}
