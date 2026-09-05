"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { IconCheckCircle, IconWarning } from "@/components/icons";

interface CorrectionVue {
  id: string;
  codeEleve: string;
  epreuve: string;
  matiere: string;
  motif: string;
  commentaireEleve: string | null;
  noteIA: number | null;
  noteOverride: number | null;
  justificationOverride: string | null;
  feedbackDetaille: string;
  dejaTraite: boolean;
}

export function CorrectionSignaleeDetail({ correction }: { correction: CorrectionVue }) {
  const router = useRouter();
  const [note, setNote] = useState(
    correction.noteOverride != null ? String(correction.noteOverride) : correction.noteIA != null ? String(correction.noteIA) : ""
  );
  const [justification, setJustification] = useState(correction.justificationOverride ?? "");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setMessage(null);
    try {
      const res = await apiFetch(`/api/admin/corrections/${correction.id}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteOverride: Number(note), justificationOverride: justification.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "erreur", texte: data.error ?? "Enregistrement impossible." });
        return;
      }
      setMessage({ type: "ok", texte: "Nouvelle note enregistrée." });
      router.refresh();
    } catch {
      setMessage({ type: "erreur", texte: "Impossible de contacter le serveur." });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="rounded-2xl bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-texte">Signalement — {correction.codeEleve}</h2>
        {correction.dejaTraite && (
          <span className="rounded-full bg-success-light px-3 py-1 text-xs font-bold text-success">Déjà traité</span>
        )}
      </div>
      <p className="mt-1 text-sm text-texte-muted">
        {correction.epreuve} · {correction.matiere} · {correction.motif}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-fond text-xs text-texte-muted">
          copie scannée
        </div>
        <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-fond text-xs text-texte-muted">
          corrigé type
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-fond p-4 text-sm text-texte">
        <p className="text-xs font-bold tracking-wide text-texte-muted uppercase">Détail correction IA</p>
        <p className="mt-1">
          Note attribuée{" "}
          <strong>
            {correction.noteIA != null ? `${correction.noteIA}/20` : "—"}
          </strong>
          {correction.noteOverride != null && (
            <>
              {" "}
              · note forcée <strong className="text-primary">{correction.noteOverride}/20</strong>
            </>
          )}
        </p>
        <p className="mt-2 line-clamp-4 text-texte-muted">{correction.feedbackDetaille}</p>
      </div>

      {correction.commentaireEleve && (
        <p className="mt-3 text-sm text-texte">
          <span className="font-semibold">Commentaire de l&apos;élève :</span> {correction.commentaireEleve}
        </p>
      )}

      <form onSubmit={enregistrer} className="mt-5 border-t border-border pt-5">
        <p className="text-sm font-semibold text-texte">Forcer une nouvelle note</p>
        <p className="mt-0.5 text-xs text-texte-muted">
          N&apos;écrase pas la sortie de l&apos;IA : elle reste consultable, la note forcée prime à l&apos;affichage.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <div className="w-24">
            <label htmlFor="noteOverride" className="sr-only">
              Nouvelle note sur 20
            </label>
            <div className="flex items-center rounded-xl border-2 border-border bg-surface px-3 py-2.5 focus-within:border-primary">
              <input
                id="noteOverride"
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                className="w-full bg-transparent text-sm text-texte outline-none"
              />
              <span className="text-sm text-texte-muted">/20</span>
            </div>
          </div>
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="justificationOverride" className="sr-only">
              Justification de la modification
            </label>
            <input
              id="justificationOverride"
              type="text"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Justification de la modification…"
              required
              className="w-full rounded-xl border-2 border-border bg-surface px-4 py-2.5 text-sm text-texte outline-none transition-colors focus:border-primary"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={enCours}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {enCours ? "Enregistrement…" : "Enregistrer la nouvelle note"}
          </button>
          {message && (
            <p role="status" className={`flex items-center gap-1.5 text-sm ${message.type === "ok" ? "text-texte-muted" : "text-danger"}`}>
              {message.type === "ok" ? (
                <IconCheckCircle className="h-4 w-4 text-success" weight="fill" aria-hidden="true" />
              ) : (
                <IconWarning className="h-4 w-4 text-danger" weight="fill" aria-hidden="true" />
              )}
              {message.texte}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
