"use client";

import { useMemo, useState } from "react";
import { IconDocument, IconDownload, IconSearch } from "@/components/icons";

interface EpreuveVue {
  id: string;
  titre: string;
  anneeScolaire: string;
  matiere: string;
  ficheUrl: string;
  corrigeUrl: string;
}

const TOUTES = "__toutes__";

function anneeCourte(anneeScolaire: string): string {
  // "2019-2020" -> "2019-20"
  const [debut, fin] = anneeScolaire.split("-");
  return fin && fin.length === 4 ? `${debut}-${fin.slice(2)}` : anneeScolaire;
}

export function BanqueEpreuves({
  epreuves,
  classeLabel,
}: {
  epreuves: EpreuveVue[];
  classeLabel: string;
}) {
  const [recherche, setRecherche] = useState("");
  const [matiere, setMatiere] = useState<string>(TOUTES);

  const matieres = useMemo(
    () => Array.from(new Set(epreuves.map((e) => e.matiere))).sort((a, b) => a.localeCompare(b, "fr")),
    [epreuves],
  );

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return epreuves.filter(
      (e) =>
        (matiere === TOUTES || e.matiere === matiere) &&
        (q === "" || e.titre.toLowerCase().includes(q) || e.matiere.toLowerCase().includes(q)),
    );
  }, [epreuves, recherche, matiere]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-texte">Banque d&apos;épreuves</h1>
          <p className="mt-1 text-sm text-texte-muted">
            Épreuves passées de ta classe — {classeLabel}. Télécharge la fiche, travaille-la sur papier, puis
            reviens photographier ta copie.
          </p>
        </div>
        <label className="relative block w-full sm:w-72">
          <IconSearch
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-texte-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une épreuve…"
            aria-label="Rechercher une épreuve"
            className="w-full rounded-full border-2 border-border bg-surface py-2 pr-4 pl-9 text-sm text-texte outline-none transition-colors focus:border-primary"
          />
        </label>
      </div>

      {epreuves.length === 0 ? (
        <EtatVide
          titre="Aucune épreuve pour l'instant"
          texte={`Il n'y a pas encore d'épreuve pour ${classeLabel} dans la banque. Reviens bientôt — de nouvelles épreuves sont ajoutées régulièrement.`}
        />
      ) : (
        <>
          {matieres.length > 1 && (
            <div className="mt-5 flex flex-wrap gap-2" role="radiogroup" aria-label="Filtrer par matière">
              <Pill actif={matiere === TOUTES} onClick={() => setMatiere(TOUTES)} label="Toutes les matières" />
              {matieres.map((m) => (
                <Pill key={m} actif={matiere === m} onClick={() => setMatiere(m)} label={m} />
              ))}
            </div>
          )}

          {filtrees.length === 0 ? (
            <EtatVide
              titre="Aucun résultat"
              texte="Aucune épreuve ne correspond à ta recherche. Essaie un autre mot-clé ou une autre matière."
            />
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtrees.map((e) => (
                <article
                  key={e.id}
                  className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm"
                >
                  <p className="text-[11px] font-bold tracking-wide text-primary uppercase">{e.matiere}</p>
                  <h2 className="mt-1 text-base font-bold text-texte">{e.titre}</h2>
                  <p className="mt-0.5 text-xs text-texte-muted">
                    {classeLabel.split(" · ")[0]} · {anneeCourte(e.anneeScolaire)}
                  </p>
                  <a
                    href={e.ficheUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary-light py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                  >
                    <IconDownload className="h-4 w-4" aria-hidden="true" />
                    Télécharger l&apos;épreuve
                  </a>
                  <a
                    href={e.corrigeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 text-center text-xs font-semibold text-texte-muted hover:text-primary hover:underline"
                  >
                    Voir le corrigé de référence
                  </a>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Pill({ actif, onClick, label }: { actif: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={actif}
      onClick={onClick}
      className={`shrink-0 rounded-full border-2 px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
        actif
          ? "border-primary bg-primary text-white"
          : "border-border bg-surface text-texte-muted hover:border-primary/40"
      }`}
    >
      {label}
    </button>
  );
}

function EtatVide({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl bg-surface px-6 py-12 text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-fond text-texte-muted">
        <IconDocument className="h-6 w-6" aria-hidden="true" />
      </span>
      <h2 className="mt-2 text-base font-bold text-texte">{titre}</h2>
      <p className="max-w-md text-sm text-texte-muted">{texte}</p>
    </div>
  );
}
