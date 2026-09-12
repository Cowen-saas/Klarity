"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { IconCheckCircle } from "@/components/icons";

const champ =
  "w-full rounded-xl border-2 border-border bg-surface px-4 py-2.5 text-sm text-texte outline-none transition-colors focus:border-primary";

export function PrixNormalManager({
  prixNormal,
  promoActive,
}: {
  prixNormal: number;
  promoActive: { nom: string | null; prix: number } | null;
}) {
  const router = useRouter();
  const [prix, setPrix] = useState(String(prixNormal));
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "erreur" | "avertissement"; texte: string } | null>(null);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    const prixNum = Number(prix);
    if (!Number.isFinite(prixNum) || prixNum <= 0) {
      setMessage({ type: "erreur", texte: "Le prix doit être un nombre positif." });
      return;
    }

    setEnCours(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/admin/parametres/prix-normal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prix: prixNum }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "erreur", texte: data.error ?? "Enregistrement impossible." });
        return;
      }
      setMessage(
        data.avertissement
          ? { type: "avertissement", texte: data.avertissement }
          : { type: "ok", texte: `Prix normal mis à jour : ${prixNum.toLocaleString("fr-FR")} FCFA.` },
      );
      router.refresh();
    } catch {
      setMessage({ type: "erreur", texte: "Impossible de contacter le serveur." });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="rounded-2xl bg-surface p-6 shadow-sm">
      <h2 className="text-base font-bold text-texte">Prix normal (hors promotion)</h2>
      <p className="mt-1 text-xs text-texte-muted">
        Prix Premium appliqué en dehors de toute fenêtre tarifaire promotionnelle — le repli utilisé quand aucune
        promo n&apos;est active.
      </p>

      <form onSubmit={soumettre} className="mt-5 flex flex-wrap items-end gap-4">
        <div className="w-full max-w-[220px]">
          <label htmlFor="prix-normal" className="mb-1.5 block text-sm font-semibold text-texte">
            Prix (FCFA / mois)
          </label>
          <input
            id="prix-normal"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
            required
            className={champ}
          />
        </div>
        <button
          type="submit"
          disabled={enCours}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {enCours ? "Enregistrement…" : "Mettre à jour"}
        </button>
        {message && (
          <p
            role="status"
            className={`flex w-full items-center gap-1.5 text-sm ${
              message.type === "erreur" ? "text-danger" : message.type === "avertissement" ? "text-danger" : "text-texte-muted"
            }`}
          >
            {message.type === "ok" && <IconCheckCircle className="h-4 w-4 text-success" weight="fill" aria-hidden="true" />}
            {message.type === "avertissement" && "⚠️ "}
            {message.texte}
          </p>
        )}
      </form>

      {promoActive && (
        <p className="mt-3 text-xs text-texte-muted">
          Une fenêtre promo est actuellement active
          {promoActive.nom ? ` (« ${promoActive.nom} »` : ""}
          {promoActive.nom ? `, ${promoActive.prix.toLocaleString("fr-FR")} FCFA)` : ""} — le prix normal ci-dessus ne
          s&apos;applique pas tant qu&apos;elle couvre la date du jour.
        </p>
      )}
    </section>
  );
}
