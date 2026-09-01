"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MOT_CONFIRMATION = "CLÔTURER";

function prenom(nom: string): string {
  return nom.trim().split(/\s+/)[0] || nom;
}

interface ClotureCompteFormProps {
  eleveId: string;
  nom: string;
  codeEleve: string;
  classeLabel: string;
}

export function ClotureCompteForm({ eleveId, nom, codeEleve, classeLabel }: ClotureCompteFormProps) {
  const router = useRouter();
  const [comprend, setComprend] = useState(false);
  const [etape, setEtape] = useState<"initiale" | "confirmation">("initiale");
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const p = prenom(nom);
  const saisieOk = saisie.trim().toUpperCase() === MOT_CONFIRMATION;

  async function cloturer() {
    setEnCours(true);
    setErreur(null);
    try {
      const res = await fetch(`/api/parent/eleve/${eleveId}/cloture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comprend: true, confirmationTexte: saisie.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.error ?? "La clôture a échoué.");
        return;
      }
      router.refresh();
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="rounded-2xl bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-bold text-texte">Clôturer le compte de mon enfant</h2>
        <p className="mt-1 text-sm text-texte-muted">
          {nom} · {codeEleve} · {classeLabel}
        </p>

        <div className="mt-4 rounded-xl bg-danger-light p-4 text-sm text-danger">
          <strong>Cette action est irréversible.</strong> Les données pédagogiques de {p} (corrections, historique de
          chat, lacunes, quiz) seront définitivement supprimées.
        </div>

        <label className="mt-4 flex items-start gap-2.5 text-sm text-texte">
          <input
            type="checkbox"
            checked={comprend}
            onChange={(e) => {
              setComprend(e.target.checked);
              if (!e.target.checked) setEtape("initiale");
            }}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          Je comprends que cette action est irréversible.
        </label>

        <button
          type="button"
          disabled={!comprend || etape === "confirmation"}
          onClick={() => setEtape("confirmation")}
          className="mt-4 w-full rounded-xl bg-danger py-3 text-sm font-semibold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:bg-border disabled:text-texte-muted"
        >
          Clôturer le compte
        </button>

        <p className="mt-4 rounded-xl bg-fond p-4 text-xs text-texte-muted">
          Les données de facturation et d&apos;abonnement sont conservées séparément pour des raisons légales, même après
          clôture du compte.
        </p>
      </section>

      {etape === "confirmation" && (
        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <p className="text-xs font-bold tracking-wide text-danger uppercase">Confirmation finale</p>
          <h2 className="mt-1 text-lg font-bold text-texte">Es-tu vraiment sûr(e) ?</h2>
          <p className="mt-2 text-sm text-texte-muted">
            Pour confirmer la clôture définitive du compte de {p}, tape <strong>{MOT_CONFIRMATION}</strong> ci-dessous.
          </p>

          <label htmlFor="confirmationCloture" className="sr-only">
            Tape {MOT_CONFIRMATION} pour confirmer
          </label>
          <input
            id="confirmationCloture"
            type="text"
            autoComplete="off"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder={`Tapez ${MOT_CONFIRMATION}`}
            className="mt-4 w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-sm text-texte outline-none transition-colors focus:border-primary"
          />

          {erreur && <p className="mt-3 text-sm text-danger">{erreur}</p>}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setEtape("initiale");
                setSaisie("");
                setErreur(null);
              }}
              className="rounded-xl border-2 border-border bg-surface px-6 py-2.5 text-sm font-semibold text-texte transition-colors hover:border-primary/40"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!saisieOk || enCours}
              onClick={cloturer}
              className="rounded-xl bg-danger px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enCours ? "Clôture…" : "Clôturer définitivement"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
