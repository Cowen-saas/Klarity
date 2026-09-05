"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { IconCalendar, IconCheckCircle } from "@/components/icons";

type TypeExamen = "BEPC" | "PROBATOIRE" | "BAC";
type Mode = "precise" | "estimee";

interface DateExamenVue {
  id: string;
  typeExamen: TypeExamen;
  anneeScolaire: string;
  dateExamen: string | null;
  datePeriodeEstimee: string | null;
  updatedAt: string;
}

const TYPES: TypeExamen[] = ["BEPC", "PROBATOIRE", "BAC"];

function anneeScolaireParDefaut(): string {
  const maintenant = new Date();
  const debut = maintenant.getMonth() >= 7 ? maintenant.getFullYear() : maintenant.getFullYear() - 1;
  return `${debut}-${debut + 1}`;
}

export function DateExamenManager({ dates }: { dates: DateExamenVue[] }) {
  const router = useRouter();
  const [typeExamen, setTypeExamen] = useState<TypeExamen>("BAC");
  const [anneeScolaire, setAnneeScolaire] = useState(anneeScolaireParDefaut());
  const [mode, setMode] = useState<Mode>("precise");
  const [dateExamen, setDateExamen] = useState("");
  const [datePeriodeEstimee, setDatePeriodeEstimee] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  function chargerPourModification(d: DateExamenVue) {
    setTypeExamen(d.typeExamen);
    setAnneeScolaire(d.anneeScolaire);
    if (d.dateExamen) {
      setMode("precise");
      setDateExamen(d.dateExamen.slice(0, 10));
      setDatePeriodeEstimee("");
    } else {
      setMode("estimee");
      setDatePeriodeEstimee(d.datePeriodeEstimee ?? "");
      setDateExamen("");
    }
    setMessage(null);
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/admin/dates-examens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeExamen,
          anneeScolaire: anneeScolaire.trim(),
          mode,
          dateExamen: mode === "precise" && dateExamen ? new Date(dateExamen).toISOString() : undefined,
          datePeriodeEstimee: mode === "estimee" ? datePeriodeEstimee.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "erreur", texte: data.error ?? "Enregistrement impossible." });
        return;
      }
      setMessage({ type: "ok", texte: `${typeExamen} ${anneeScolaire} enregistré.` });
      router.refresh();
    } catch {
      setMessage({ type: "erreur", texte: "Impossible de contacter le serveur." });
    } finally {
      setEnCours(false);
    }
  }

  const parAnnee = dates.reduce<Record<string, DateExamenVue[]>>((acc, d) => {
    (acc[d.anneeScolaire] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
      <form onSubmit={soumettre} className="rounded-2xl bg-surface p-6 shadow-sm">
        <h2 className="text-base font-bold text-texte">Ajouter ou modifier une date</h2>
        <p className="mt-1 text-xs text-texte-muted">
          Ré-enregistrer un examen déjà présent pour la même année scolaire le met à jour.
        </p>

        <fieldset className="mt-5 border-0 p-0">
          <legend className="mb-2 text-xs font-semibold tracking-wide text-primary uppercase">Examen</legend>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={typeExamen === t}
                onClick={() => setTypeExamen(t)}
                className={`rounded-xl border-2 py-2.5 text-sm font-bold transition-colors ${
                  typeExamen === t
                    ? "border-primary bg-primary-light text-primary"
                    : "border-border bg-surface text-texte hover:border-primary/40"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          <label htmlFor="anneeScolaire" className="mb-1.5 block text-sm font-semibold text-texte">
            Année scolaire
          </label>
          <input
            id="anneeScolaire"
            type="text"
            inputMode="numeric"
            value={anneeScolaire}
            onChange={(e) => setAnneeScolaire(e.target.value)}
            placeholder="2026-2027"
            className="w-full rounded-xl border-2 border-border bg-surface px-4 py-2.5 text-sm text-texte outline-none transition-colors focus:border-primary"
          />
        </div>

        <fieldset className="mt-5 border-0 p-0">
          <legend className="mb-2 text-xs font-semibold tracking-wide text-primary uppercase">Type de date</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={mode === "precise"}
              onClick={() => setMode("precise")}
              className={`rounded-xl border-2 py-2.5 text-sm font-bold transition-colors ${
                mode === "precise" ? "border-primary bg-primary-light text-primary" : "border-border bg-surface text-texte hover:border-primary/40"
              }`}
            >
              Date précise
            </button>
            <button
              type="button"
              aria-pressed={mode === "estimee"}
              onClick={() => setMode("estimee")}
              className={`rounded-xl border-2 py-2.5 text-sm font-bold transition-colors ${
                mode === "estimee" ? "border-primary bg-primary-light text-primary" : "border-border bg-surface text-texte hover:border-primary/40"
              }`}
            >
              Période estimée
            </button>
          </div>
        </fieldset>

        {mode === "precise" ? (
          <div className="mt-4">
            <label htmlFor="dateExamen" className="mb-1.5 block text-sm font-semibold text-texte">
              Date de l&apos;examen
            </label>
            <input
              id="dateExamen"
              type="date"
              value={dateExamen}
              onChange={(e) => setDateExamen(e.target.value)}
              className="w-full rounded-xl border-2 border-border bg-surface px-4 py-2.5 text-sm text-texte outline-none transition-colors focus:border-primary"
            />
          </div>
        ) : (
          <div className="mt-4">
            <label htmlFor="datePeriodeEstimee" className="mb-1.5 block text-sm font-semibold text-texte">
              Période estimée
            </label>
            <input
              id="datePeriodeEstimee"
              type="text"
              value={datePeriodeEstimee}
              onChange={(e) => setDatePeriodeEstimee(e.target.value)}
              placeholder="Courant juin 2027"
              className="w-full rounded-xl border-2 border-border bg-surface px-4 py-2.5 text-sm text-texte outline-none transition-colors focus:border-primary"
            />
            <p className="mt-1 text-xs text-texte-muted">
              Affichée telle quelle tant qu&apos;aucune date précise n&apos;est connue.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={enCours}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {enCours ? "Enregistrement…" : "Enregistrer"}
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

      <section className="rounded-2xl bg-surface p-6 shadow-sm">
        <h2 className="text-base font-bold text-texte">Calendrier actuel</h2>
        {dates.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-fond px-4 py-8 text-center">
            <IconCalendar className="h-6 w-6 text-texte-muted" aria-hidden="true" />
            <p className="text-sm text-texte-muted">
              Aucune date d&apos;examen renseignée. Le compte à rebours des tableaux de bord reste masqué tant qu&apos;il
              n&apos;y en a pas.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {Object.entries(parAnnee).map(([annee, lignes]) => (
              <div key={annee}>
                <p className="text-xs font-bold tracking-wide text-texte-muted uppercase">Année scolaire {annee}</p>
                <div className="mt-2 divide-y divide-border">
                  {lignes.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-semibold text-texte">{d.typeExamen}</p>
                        <p className="text-xs text-texte-muted">
                          {d.dateExamen ? (
                            <>
                              <span className="font-semibold text-primary">Précise</span> ·{" "}
                              {new Date(d.dateExamen).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </>
                          ) : (
                            <>
                              <span className="font-semibold text-accent">Estimée</span> · {d.datePeriodeEstimee}
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => chargerPourModification(d)}
                        className="shrink-0 text-sm font-semibold text-primary hover:underline"
                      >
                        Modifier
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
