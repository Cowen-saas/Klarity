"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { IconCheckCircle, IconWarning } from "@/components/icons";
import { PaiementStepper } from "@/components/abonnement/PaiementStepper";

type StatutPaiement = "EN_ATTENTE" | "REUSSI" | "ECHEC" | "REMBOURSE";

interface VerificationPollProps {
  paiementId: string;
  statutInitial: StatutPaiement;
  eleveId: string;
  retourDashboard: string;
}

const INTERVALLE_MS = 1500;

/**
 * Écran 17 — les 3 états (vérification / confirmé / échoué) (§5.2). Le
 * stepper est rendu ici, pas dans la page serveur qui englobe ce composant :
 * son étape "Vérification" doit se cocher dès que le statut polled passe à
 * REUSSI/ECHEC, pas seulement au rendu initial (sinon elle reste bloquée sur
 * "en cours" tant que la page n'est pas rechargée manuellement).
 */
export function VerificationPoll({ paiementId, statutInitial, eleveId, retourDashboard }: VerificationPollProps) {
  const [statut, setStatut] = useState<StatutPaiement>(statutInitial);
  const etapeStepper = statut === "EN_ATTENTE" ? 3 : 4;

  useEffect(() => {
    if (statut !== "EN_ATTENTE") return;
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/paiement/${paiementId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.statut && data.statut !== "EN_ATTENTE") {
          setStatut(data.statut);
        }
      } catch {
        // Silencieux — la prochaine itération réessaiera.
      }
    }, INTERVALLE_MS);
    return () => clearInterval(interval);
  }, [statut, paiementId]);

  return (
    <div className="mx-auto max-w-4xl">
      <PaiementStepper step={etapeStepper} />
      <div className="mx-auto max-w-md rounded-3xl bg-surface p-10 text-center shadow-sm">
        {statut === "EN_ATTENTE" && (
          <>
            <Spinner />
            <h1 className="mt-5 text-lg font-bold text-texte">Vérification de votre paiement...</h1>
            <p className="mt-1 text-sm text-texte-muted">Merci de patienter quelques instants.</p>
          </>
        )}

        {statut === "REUSSI" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-success">
              <IconCheckCircle className="h-8 w-8" weight="fill" aria-hidden="true" />
            </div>
            <h1 className="mt-5 text-lg font-bold text-texte">Paiement confirmé !</h1>
            <p className="mt-1 text-sm text-texte-muted">Votre abonnement Premium est maintenant actif.</p>
            <Link
              href={retourDashboard}
              className="mt-6 block rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Accéder à mon tableau de bord
            </Link>
          </>
        )}

        {(statut === "ECHEC" || statut === "REMBOURSE") && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger-light text-danger">
              <IconWarning className="h-8 w-8" weight="fill" aria-hidden="true" />
            </div>
            <h1 className="mt-5 text-lg font-bold text-texte">Le paiement n&apos;a pas pu être confirmé.</h1>
            <p className="mt-1 text-sm text-texte-muted">Vérifiez votre solde ou réessayez avec un autre moyen.</p>
            <Link
              href={`/abonnement/paiement?eleve=${eleveId}`}
              className="mt-6 block rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Réessayer
            </Link>
            <Link
              href={`/abonnement/paiement?eleve=${eleveId}`}
              className="mt-3 block rounded-xl border-2 border-border bg-surface py-3 text-center text-sm font-semibold text-texte transition-colors hover:border-primary/40"
            >
              Utiliser un autre numéro
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div
      className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-primary-light border-t-primary"
      role="status"
      aria-label="Vérification en cours"
    />
  );
}
