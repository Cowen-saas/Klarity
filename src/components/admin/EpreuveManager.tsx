"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { IconDocument, IconCheckCircle } from "@/components/icons";

type NiveauClasse = "TROISIEME" | "PREMIERE" | "TERMINALE";
type Filiere = "A" | "C" | "D" | "TI";

const CLASSE_LABELS: Record<NiveauClasse, string> = {
  TROISIEME: "3ᵉ",
  PREMIERE: "1ʳᵉ",
  TERMINALE: "Terminale",
};
const CLASSES: NiveauClasse[] = ["TROISIEME", "PREMIERE", "TERMINALE"];
const FILIERES: Filiere[] = ["A", "C", "D", "TI"];

interface MatiereVue {
  id: string;
  nom: string;
  classesConcernees: NiveauClasse[];
  filiereRequise: Filiere[];
}

interface EpreuveVue {
  id: string;
  titre: string;
  classe: NiveauClasse;
  filiere: Filiere | null;
  anneeScolaire: string;
  createdAt: string;
  ficheUrl: string;
  corrigeUrl: string;
  matiere: { nom: string };
}

function anneeScolaireParDefaut(): string {
  const maintenant = new Date();
  const debut = maintenant.getMonth() >= 7 ? maintenant.getFullYear() : maintenant.getFullYear() - 1;
  return `${debut}-${debut + 1}`;
}

export function EpreuveManager({ epreuves, matieres }: { epreuves: EpreuveVue[]; matieres: MatiereVue[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [classe, setClasse] = useState<NiveauClasse>("TERMINALE");
  const [filiere, setFiliere] = useState<Filiere>("C");
  const [matiereId, setMatiereId] = useState("");
  const [titre, setTitre] = useState("");
  const [anneeScolaire, setAnneeScolaire] = useState(anneeScolaireParDefaut());
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  const filiereRequise = classe !== "TROISIEME";

  const matieresDispo = useMemo(
    () =>
      matieres.filter(
        (m) =>
          m.classesConcernees.includes(classe) &&
          (!filiereRequise || m.filiereRequise.length === 0 || m.filiereRequise.includes(filiere))
      ),
    [matieres, classe, filiere, filiereRequise]
  );

  async function soumettre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("classe", classe);
    if (filiereRequise) form.set("filiere", filiere);
    else form.delete("filiere");
    form.set("matiereId", matiereId);
    form.set("titre", titre.trim());
    form.set("anneeScolaire", anneeScolaire.trim());

    setEnCours(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/admin/epreuves", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "erreur", texte: data.error ?? "Ajout impossible." });
        return;
      }
      setMessage({ type: "ok", texte: `Épreuve « ${data.epreuve.titre} » ajoutée.` });
      setTitre("");
      setMatiereId("");
      formRef.current?.reset();
      router.refresh();
    } catch {
      setMessage({ type: "erreur", texte: "Impossible de contacter le serveur." });
    } finally {
      setEnCours(false);
    }
  }

  const champInput =
    "w-full rounded-xl border-2 border-border bg-surface px-4 py-2.5 text-sm text-texte outline-none transition-colors focus:border-primary";

  return (
    <div className="space-y-6">
      <form ref={formRef} onSubmit={soumettre} className="rounded-2xl bg-surface p-6 shadow-sm">
        <h2 className="text-base font-bold text-texte">Ajouter une épreuve</h2>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <fieldset className="border-0 p-0">
            <legend className="mb-2 text-xs font-semibold tracking-wide text-primary uppercase">Classe</legend>
            <div className="flex gap-2">
              {CLASSES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={classe === c}
                  onClick={() => {
                    setClasse(c);
                    setMatiereId("");
                  }}
                  className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-bold transition-colors ${
                    classe === c ? "border-primary bg-primary-light text-primary" : "border-border bg-surface text-texte hover:border-primary/40"
                  }`}
                >
                  {CLASSE_LABELS[c]}
                </button>
              ))}
            </div>
          </fieldset>

          {filiereRequise && (
            <fieldset className="border-0 p-0">
              <legend className="mb-2 text-xs font-semibold tracking-wide text-primary uppercase">Filière</legend>
              <div className="flex gap-2">
                {FILIERES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filiere === f}
                    onClick={() => {
                      setFiliere(f);
                      setMatiereId("");
                    }}
                    className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-bold transition-colors ${
                      filiere === f ? "border-primary bg-primary-light text-primary" : "border-border bg-surface text-texte hover:border-primary/40"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <div className="mt-5">
          <label htmlFor="matiereId" className="mb-1.5 block text-sm font-semibold text-texte">
            Matière
          </label>
          <select
            id="matiereId"
            value={matiereId}
            onChange={(e) => setMatiereId(e.target.value)}
            required
            className={champInput}
          >
            <option value="" disabled>
              {matieresDispo.length === 0 ? "Aucune matière pour cette classe/filière" : "Choisir une matière"}
            </option>
            {matieresDispo.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="titre" className="mb-1.5 block text-sm font-semibold text-texte">
              Titre de l&apos;épreuve
            </label>
            <input
              id="titre"
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Baccalauréat blanc — Mathématiques"
              required
              className={champInput}
            />
          </div>
          <div>
            <label htmlFor="anneeScolaireEpreuve" className="mb-1.5 block text-sm font-semibold text-texte">
              Année scolaire
            </label>
            <input
              id="anneeScolaireEpreuve"
              type="text"
              inputMode="numeric"
              value={anneeScolaire}
              onChange={(e) => setAnneeScolaire(e.target.value)}
              placeholder="2026-2027"
              required
              className={champInput}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="fichePdf" className="mb-1.5 block text-sm font-semibold text-texte">
              Fiche de l&apos;épreuve (PDF)
            </label>
            <input id="fichePdf" name="fichePdf" type="file" accept="application/pdf" required className="block w-full text-sm text-texte-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary-light file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary" />
          </div>
          <div>
            <label htmlFor="corrigeReference" className="mb-1.5 block text-sm font-semibold text-texte">
              Corrigé de référence (PDF)
            </label>
            <input id="corrigeReference" name="corrigeReference" type="file" accept="application/pdf" required className="block w-full text-sm text-texte-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary-light file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary" />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={enCours || !matiereId}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {enCours ? "Ajout en cours…" : "Ajouter l'épreuve"}
          </button>
          {message && (
            <p role="status" className={`flex items-center gap-1.5 text-sm ${message.type === "ok" ? "text-texte-muted" : "text-danger"}`}>
              {message.type === "ok" && <IconCheckCircle className="h-4 w-4 text-success" weight="fill" aria-hidden="true" />}
              {message.texte}
            </p>
          )}
        </div>
      </form>

      <section className="rounded-2xl bg-surface p-6 shadow-sm">
        <h2 className="text-base font-bold text-texte">Épreuves dans la banque</h2>
        {epreuves.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-fond px-4 py-8 text-center">
            <IconDocument className="h-6 w-6 text-texte-muted" aria-hidden="true" />
            <p className="max-w-md text-sm text-texte-muted">
              Aucune épreuve pour l&apos;instant. La banque sera alimentée quand la source externe (base Supabase tierce)
              sera accessible — l&apos;outil d&apos;ajout ci-dessus est déjà opérationnel.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-texte-muted uppercase">
                  <th className="pb-2 font-semibold">Titre</th>
                  <th className="pb-2 font-semibold">Classe</th>
                  <th className="pb-2 font-semibold">Matière</th>
                  <th className="pb-2 font-semibold">Année</th>
                  <th className="pb-2 font-semibold">Ajoutée</th>
                  <th className="pb-2 font-semibold">Fichiers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {epreuves.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2.5 font-semibold text-texte">{e.titre}</td>
                    <td className="py-2.5 text-texte-muted">
                      {CLASSE_LABELS[e.classe]}
                      {e.filiere ? ` ${e.filiere}` : ""}
                    </td>
                    <td className="py-2.5 text-texte-muted">{e.matiere.nom}</td>
                    <td className="py-2.5 text-texte-muted">{e.anneeScolaire}</td>
                    <td className="py-2.5 text-texte-muted">
                      {new Date(e.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-2.5">
                      <a href={e.ficheUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
                        Fiche
                      </a>
                      <span className="mx-1.5 text-border">·</span>
                      <a href={e.corrigeUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
                        Corrigé
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
