"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { IconCheckCircle, IconCoins } from "@/components/icons";

interface PeriodeVue {
  id: string;
  nom: string;
  dateDebut: string; // ISO
  dateFin: string; // ISO
  prixApplique: number;
  actif: boolean;
  couvreAujourdhui: boolean;
}

const champ =
  "w-full rounded-xl border-2 border-border bg-surface px-4 py-2.5 text-sm text-texte outline-none transition-colors focus:border-primary";

function isoEnDateInput(iso: string): string {
  return iso.slice(0, 10);
}

function formatDate(iso: string): string {
  // Bornes stockées en UTC (cf. API) — on les affiche en UTC pour retrouver la
  // journée exacte saisie par l'admin.
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function PeriodeTarifaireManager({
  periodes,
  prixNormal,
}: {
  periodes: PeriodeVue[];
  prixNormal: number;
}) {
  const router = useRouter();
  const [editionId, setEditionId] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [prix, setPrix] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);
  const [confirmSuppr, setConfirmSuppr] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  function reinitialiser() {
    setEditionId(null);
    setNom("");
    setDateDebut("");
    setDateFin("");
    setPrix("");
    setMessage(null);
  }

  function chargerPourModification(p: PeriodeVue) {
    setEditionId(p.id);
    setNom(p.nom);
    setDateDebut(isoEnDateInput(p.dateDebut));
    setDateFin(isoEnDateInput(p.dateFin));
    setPrix(String(p.prixApplique));
    setMessage(null);
    setConfirmSuppr(null);
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    const prixNum = Number(prix);
    if (!nom.trim() || !dateDebut || !dateFin) {
      setMessage({ type: "erreur", texte: "Renseigne le nom et les deux dates." });
      return;
    }
    if (!Number.isFinite(prixNum) || prixNum <= 0) {
      setMessage({ type: "erreur", texte: "Le prix doit être un nombre positif." });
      return;
    }
    if (new Date(dateFin) < new Date(dateDebut)) {
      setMessage({ type: "erreur", texte: "La date de fin doit être postérieure à la date de début." });
      return;
    }

    setEnCours(true);
    setMessage(null);
    try {
      const res = await apiFetch(
        editionId
          ? `/api/admin/parametres/periodes-tarifaires/${editionId}`
          : "/api/admin/parametres/periodes-tarifaires",
        {
          method: editionId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nom: nom.trim(), dateDebut, dateFin, prix: prixNum }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "erreur", texte: data.error ?? "Enregistrement impossible." });
        return;
      }
      setMessage({ type: "ok", texte: editionId ? `« ${nom.trim()} » mise à jour.` : `« ${nom.trim()} » ajoutée.` });
      reinitialiser();
      router.refresh();
    } catch {
      setMessage({ type: "erreur", texte: "Impossible de contacter le serveur." });
    } finally {
      setEnCours(false);
    }
  }

  async function basculerActif(p: PeriodeVue) {
    setActionId(p.id);
    try {
      const res = await apiFetch(`/api/admin/parametres/periodes-tarifaires/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actif: !p.actif }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: "erreur", texte: data.error ?? "Changement impossible." });
        return;
      }
      router.refresh();
    } catch {
      setMessage({ type: "erreur", texte: "Impossible de contacter le serveur." });
    } finally {
      setActionId(null);
    }
  }

  async function supprimer(id: string) {
    setActionId(id);
    try {
      const res = await apiFetch(`/api/admin/parametres/periodes-tarifaires/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: "erreur", texte: data.error ?? "Suppression impossible." });
        return;
      }
      if (editionId === id) reinitialiser();
      setConfirmSuppr(null);
      router.refresh();
    } catch {
      setMessage({ type: "erreur", texte: "Impossible de contacter le serveur." });
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
      <form onSubmit={soumettre} className="rounded-2xl bg-surface p-6 shadow-sm">
        <h2 className="text-base font-bold text-texte">
          {editionId ? "Modifier la fenêtre tarifaire" : "Nouvelle fenêtre tarifaire"}
        </h2>
        <p className="mt-1 text-xs text-texte-muted">
          Tarif normal hors promo : <strong>{prixNormal.toLocaleString("fr-FR")} FCFA / mois</strong>.
        </p>

        <div className="mt-5">
          <label htmlFor="pt-nom" className="mb-1.5 block text-sm font-semibold text-texte">
            Nom
          </label>
          <input
            id="pt-nom"
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Promo Noël 2026"
            required
            className={champ}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="pt-debut" className="mb-1.5 block text-sm font-semibold text-texte">
              Début (inclus)
            </label>
            <input id="pt-debut" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required className={champ} />
          </div>
          <div>
            <label htmlFor="pt-fin" className="mb-1.5 block text-sm font-semibold text-texte">
              Fin (incluse)
            </label>
            <input id="pt-fin" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} required className={champ} />
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="pt-prix" className="mb-1.5 block text-sm font-semibold text-texte">
            Prix promo (FCFA / mois)
          </label>
          <input
            id="pt-prix"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
            placeholder="3000"
            required
            className={champ}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={enCours}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {enCours ? "Enregistrement…" : editionId ? "Mettre à jour" : "Ajouter"}
          </button>
          {editionId && (
            <button type="button" onClick={reinitialiser} className="text-sm font-semibold text-texte-muted hover:text-texte">
              Annuler
            </button>
          )}
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
        <h2 className="text-base font-bold text-texte">Fenêtres configurées</h2>
        {periodes.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-fond px-4 py-8 text-center">
            <IconCoins className="h-6 w-6 text-texte-muted" aria-hidden="true" />
            <p className="text-sm text-texte-muted">
              Aucune fenêtre promo. Le prix Premium reste à {prixNormal.toLocaleString("fr-FR")} FCFA toute l&apos;année.
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border">
            {periodes.map((p) => (
              <div key={p.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-texte">
                      {p.nom}
                      {p.actif && p.couvreAujourdhui ? (
                        <span className="rounded-full bg-success-light px-2 py-0.5 text-[10px] font-bold text-success">Appliquée</span>
                      ) : p.actif ? (
                        <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-bold text-primary">Active</span>
                      ) : (
                        <span className="rounded-full bg-fond px-2 py-0.5 text-[10px] font-bold text-texte-muted">Désactivée</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-texte-muted">
                      {formatDate(p.dateDebut)} → {formatDate(p.dateFin)} · {p.prixApplique.toLocaleString("fr-FR")} FCFA
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
                  <button type="button" onClick={() => chargerPourModification(p)} className="text-primary hover:underline">
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => basculerActif(p)}
                    disabled={actionId === p.id}
                    className="text-texte-muted hover:text-texte disabled:opacity-50"
                  >
                    {p.actif ? "Désactiver" : "Activer"}
                  </button>
                  {confirmSuppr === p.id ? (
                    <span className="flex items-center gap-2 text-danger">
                      Confirmer ?
                      <button type="button" onClick={() => supprimer(p.id)} disabled={actionId === p.id} className="underline">
                        Oui
                      </button>
                      <button type="button" onClick={() => setConfirmSuppr(null)} className="text-texte-muted underline">
                        Non
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmSuppr(p.id)} className="text-danger hover:underline">
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
