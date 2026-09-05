"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { IconCheckCircle } from "@/components/icons";

type TypeExercice =
  | "DISSERTATION_PHILO"
  | "DISSERTATION_LITTERAIRE"
  | "CONTRACTION_TEXTE"
  | "DISCUSSION"
  | "COMMENTAIRE_COMPOSE"
  | "EXPRESSION_ECRITE"
  | "CORRECTION_ORTHOGRAPHIQUE";

const TYPES: { value: TypeExercice; label: string }[] = [
  { value: "DISSERTATION_PHILO", label: "Dissertation philosophique" },
  { value: "DISSERTATION_LITTERAIRE", label: "Dissertation littéraire" },
  { value: "CONTRACTION_TEXTE", label: "Contraction de texte" },
  { value: "DISCUSSION", label: "Discussion" },
  { value: "COMMENTAIRE_COMPOSE", label: "Commentaire composé" },
  { value: "EXPRESSION_ECRITE", label: "Expression écrite (3ᵉ)" },
  { value: "CORRECTION_ORTHOGRAPHIQUE", label: "Correction orthographique (3ᵉ)" },
];

interface MatiereOption {
  id: string;
  nom: string;
}

const champ =
  "w-full rounded-xl border-2 border-border bg-surface px-4 py-2.5 text-sm text-texte outline-none transition-colors focus:border-primary";

export function ExempleCorrectionForm({ matieres }: { matieres: MatiereOption[] }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [matiereId, setMatiereId] = useState(matieres[0]?.id ?? "");
  const [typeExercice, setTypeExercice] = useState<TypeExercice>("DISSERTATION_LITTERAIRE");
  const [enonceModele, setEnonceModele] = useState("");
  const [baremeStructure, setBaremeStructure] = useState("");
  const [exempleReponseModele, setExempleReponseModele] = useState("");
  const [notesMethodologiques, setNotesMethodologiques] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/admin/exemples-corriges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matiereId,
          typeExercice,
          enonceModele,
          baremeStructure,
          exempleReponseModele,
          notesMethodologiques,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "erreur", texte: data.error ?? "Ajout impossible." });
        return;
      }
      setMessage({ type: "ok", texte: `Exemple « ${data.exemple.matiere.nom} · ${data.exemple.typeExercice} » ajouté.` });
      setEnonceModele("");
      setBaremeStructure("");
      setExempleReponseModele("");
      setNotesMethodologiques("");
      router.refresh();
    } catch {
      setMessage({ type: "erreur", texte: "Impossible de contacter le serveur." });
    } finally {
      setEnCours(false);
    }
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
      >
        + Ajouter une copie
      </button>
    );
  }

  return (
    <form onSubmit={soumettre} className="rounded-2xl bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-texte">Ajouter un exemple de correction</h2>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="text-sm font-semibold text-texte-muted hover:text-texte"
        >
          Annuler
        </button>
      </div>
      <p className="mt-1 text-sm text-texte-muted">
        Ces exemples servent de few-shot au moteur de correction (§4.2.2), résolus par matière + type d&apos;exercice.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="ec-matiere" className="mb-1.5 block text-sm font-semibold text-texte">
            Matière
          </label>
          <select id="ec-matiere" value={matiereId} onChange={(e) => setMatiereId(e.target.value)} required className={champ}>
            {matieres.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ec-type" className="mb-1.5 block text-sm font-semibold text-texte">
            Type d&apos;exercice
          </label>
          <select
            id="ec-type"
            value={typeExercice}
            onChange={(e) => setTypeExercice(e.target.value as TypeExercice)}
            required
            className={champ}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="ec-enonce" className="mb-1.5 block text-sm font-semibold text-texte">
          Énoncé modèle
        </label>
        <textarea
          id="ec-enonce"
          value={enonceModele}
          onChange={(e) => setEnonceModele(e.target.value)}
          required
          rows={3}
          className={champ}
        />
      </div>

      <div className="mt-5">
        <label htmlFor="ec-bareme" className="mb-1.5 block text-sm font-semibold text-texte">
          Barème (JSON)
        </label>
        <textarea
          id="ec-bareme"
          value={baremeStructure}
          onChange={(e) => setBaremeStructure(e.target.value)}
          required
          rows={6}
          placeholder='{ "totalPoints": 20, "criteres": [ … ] }'
          className={`${champ} font-mono text-xs`}
        />
        <p className="mt-1 text-xs text-texte-muted">Doit être un objet JSON valide (structure propre au type de barème).</p>
      </div>

      <div className="mt-5">
        <label htmlFor="ec-reponse" className="mb-1.5 block text-sm font-semibold text-texte">
          Exemple de réponse modèle
        </label>
        <textarea
          id="ec-reponse"
          value={exempleReponseModele}
          onChange={(e) => setExempleReponseModele(e.target.value)}
          required
          rows={5}
          className={champ}
        />
      </div>

      <div className="mt-5">
        <label htmlFor="ec-notes" className="mb-1.5 block text-sm font-semibold text-texte">
          Notes méthodologiques
        </label>
        <textarea
          id="ec-notes"
          value={notesMethodologiques}
          onChange={(e) => setNotesMethodologiques(e.target.value)}
          required
          rows={4}
          className={champ}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={enCours}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {enCours ? "Ajout en cours…" : "Ajouter l'exemple"}
        </button>
        {message && (
          <p
            role="status"
            className={`flex items-center gap-1.5 text-sm ${message.type === "ok" ? "text-texte-muted" : "text-danger"}`}
          >
            {message.type === "ok" && <IconCheckCircle className="h-4 w-4 text-success" weight="fill" aria-hidden="true" />}
            {message.texte}
          </p>
        )}
      </div>
    </form>
  );
}
