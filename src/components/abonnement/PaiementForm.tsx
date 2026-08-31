"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheckCircle, IconLock } from "@/components/icons";
import { PinInput } from "@/components/ui/PinInput";

interface PaiementFormProps {
  eleveId: string;
  montant: number;
  devise: string;
  reduction: number;
  prixNormal: number;
  payeurRole: "ELEVE" | "PARENT";
}

type Operateur = "ORANGE" | "MTN";
type SousEtape = "methode" | "formulaire" | "revalidation";

const DEV_HINT_VISIBLE = process.env.NODE_ENV !== "production";

/**
 * Écrans 15 (choix du moyen) + 16 (formulaire Mobile Money) — §2.4, §2.6 —
 * plus une re-vérification légère du PIN juste avant validation, **mais
 * uniquement pour un élève payeur** (§2.6, §5.4 — renforcement demandé
 * explicitement ; un parent a déjà une vérification forte à la connexion,
 * OTP SMS, donc aucune étape supplémentaire ici pour lui). Ne crée aucune
 * session — seule la requête d'initiation du paiement en dépend.
 */
export function PaiementForm({ eleveId, montant, devise, reduction, prixNormal, payeurRole }: PaiementFormProps) {
  const router = useRouter();
  const [sousEtape, setSousEtape] = useState<SousEtape>("methode");
  const [operateur, setOperateur] = useState<Operateur | null>(null);
  const [telephone, setTelephone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verrouille, setVerrouille] = useState(false);

  function validerFormulaire(): boolean {
    if (!operateur) {
      setError("Choisis un opérateur.");
      return false;
    }
    if (!/^6\d{8}$/.test(telephone.replace(/\D/g, ""))) {
      setError("Numéro Mobile Money invalide (9 chiffres, commence par 6).");
      return false;
    }
    setError(null);
    return true;
  }

  async function soumettrePaiement(pinConfirmation?: string) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/paiement/initier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eleveId,
          operateur,
          telephone: telephone.replace(/\D/g, ""),
          ...(pinConfirmation ? { pin: pinConfirmation } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue, réessaie.");
        setSubmitting(false);
        if (res.status === 423) {
          setVerrouille(true);
        } else if (payeurRole === "ELEVE") {
          setPin("");
        }
        return;
      }
      router.push(`/abonnement/verification/${data.paiementId}?eleve=${eleveId}`);
    } catch {
      setError("Impossible de contacter le serveur, vérifie ta connexion.");
      setSubmitting(false);
    }
  }

  function handlePayer() {
    if (!validerFormulaire()) return;
    if (payeurRole === "ELEVE") {
      setPin("");
      setVerrouille(false);
      setSousEtape("revalidation");
    } else {
      soumettrePaiement();
    }
  }

  function handleConfirmerEtPayer() {
    if (!/^\d{4}$/.test(pin)) {
      setError("Entre ton code secret à 4 chiffres.");
      return;
    }
    setError(null);
    soumettrePaiement(pin);
  }

  return (
    <div className="grid grid-cols-1 gap-6 rounded-3xl bg-surface p-6 shadow-sm sm:p-10 lg:grid-cols-[3fr_2fr]">
      <div>
        {sousEtape === "methode" && (
          <>
            <h1 className="text-lg font-bold text-texte">Votre moyen de paiement</h1>
            <button
              type="button"
              onClick={() => setSousEtape("formulaire")}
              className="mt-5 flex w-full items-center justify-between rounded-xl border-2 border-primary bg-primary-light px-5 py-4 text-left"
            >
              <span>
                <span className="block text-sm font-bold text-texte">📱 Mobile Money</span>
                <span className="block text-xs text-texte-muted">Orange Money, MTN MoMo</span>
              </span>
              <IconCheckCircle className="h-5 w-5 text-primary" weight="fill" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setSousEtape("formulaire")}
              className="mt-6 w-full rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Continuer
            </button>
          </>
        )}

        {sousEtape === "formulaire" && (
          <>
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">Étape 2 sur 4 · Paiement</p>
            <h1 className="mt-1 text-lg font-bold text-texte">Mobile Money</h1>

            <label className="mt-6 mb-2 block text-sm font-semibold text-texte">Pays</label>
            <div className="rounded-xl border-2 border-border px-4 py-3 text-sm text-texte">🇨🇲 Cameroun</div>

            <fieldset className="mt-5 border-0 p-0">
              <legend className="mb-2 text-sm font-semibold text-texte">Opérateur</legend>
              <div className="grid grid-cols-2 gap-3">
                {(["ORANGE", "MTN"] as const).map((op) => (
                  <label
                    key={op}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-light ${
                      operateur === op ? "" : "border-border text-texte"
                    }`}
                  >
                    <input
                      type="radio"
                      name="operateur"
                      className="sr-only"
                      checked={operateur === op}
                      onChange={() => setOperateur(op)}
                    />
                    <span
                      className={`h-4 w-4 rounded ${op === "ORANGE" ? "bg-[#ff7900]" : "bg-[#ffcc00]"}`}
                      aria-hidden="true"
                    />
                    {op === "ORANGE" ? "Orange Money" : "MTN MoMo"}
                  </label>
                ))}
              </div>
            </fieldset>

            <label htmlFor="telephone" className="mt-5 mb-2 block text-sm font-semibold text-texte">
              Numéro de téléphone
            </label>
            <div className="flex items-center gap-2 rounded-xl border-2 border-border px-4 py-3 focus-within:border-primary">
              <span className="text-sm text-texte-muted">+237</span>
              <input
                id="telephone"
                type="tel"
                inputMode="numeric"
                autoFocus
                value={telephone}
                onChange={(e) => setTelephone(e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder="6XX XXX XXX"
                className="w-full text-base text-texte outline-none"
              />
            </div>
            {DEV_HINT_VISIBLE && (
              <p className="mt-2 text-xs text-texte-muted">
                Mode simulation : un numéro terminé par 0 échoue, tout autre numéro réussit.
              </p>
            )}

            <div className="mt-6 flex items-center justify-between rounded-xl bg-fond px-4 py-3 text-sm">
              <span className="text-texte-muted">Total à payer</span>
              <span className="font-bold text-texte">
                {montant.toLocaleString("fr-FR")} {devise === "XAF" ? "FCFA" : devise}
              </span>
            </div>

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <button
              type="button"
              onClick={handlePayer}
              disabled={submitting}
              className="mt-6 w-full rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              {submitting
                ? "Envoi de la demande..."
                : `Payer ${montant.toLocaleString("fr-FR")} ${devise === "XAF" ? "FCFA" : devise}`}
            </button>
          </>
        )}

        {sousEtape === "revalidation" && (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
              <IconLock className="h-7 w-7" weight="fill" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-lg font-bold text-texte">Confirme avec ton code secret</h1>
            <p className="mt-1 text-sm text-texte-muted">
              Pour valider ce paiement, entre ton code secret à 4 chiffres.
            </p>
            <div className="mt-6 flex justify-center">
              <PinInput id="pin-confirmation" label="Code secret" value={pin} onChange={setPin} autoFocus />
            </div>

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}

            <button
              type="button"
              onClick={handleConfirmerEtPayer}
              disabled={submitting || verrouille}
              className="mt-6 w-full rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              {submitting
                ? "Vérification..."
                : `Confirmer et payer ${montant.toLocaleString("fr-FR")} ${devise === "XAF" ? "FCFA" : devise}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setSousEtape("formulaire");
                setError(null);
                setVerrouille(false);
              }}
              className="mt-3 text-sm font-medium text-texte-muted hover:text-texte"
            >
              ← Modifier le numéro
            </button>
          </div>
        )}
      </div>

      <aside className="rounded-2xl bg-fond p-6">
        <p className="text-xs font-semibold tracking-wide text-texte-muted uppercase">Votre abonnement</p>
        <p className="mt-2 text-base font-bold text-texte">Premium</p>
        {reduction > 0 && <p className="mt-1 text-sm font-semibold text-danger">🎁 Offre en cours -{Math.round((reduction / prixNormal) * 100)}%</p>}
        <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          {reduction > 0 && (
            <>
              <div className="flex justify-between text-texte-muted">
                <span>Prix normal</span>
                <span className="line-through">{prixNormal.toLocaleString("fr-FR")} FCFA</span>
              </div>
              <div className="flex justify-between text-danger">
                <span>Réduction</span>
                <span>-{reduction.toLocaleString("fr-FR")} FCFA</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-texte">
            <span>Total</span>
            <span>{montant.toLocaleString("fr-FR")} FCFA/mois</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
