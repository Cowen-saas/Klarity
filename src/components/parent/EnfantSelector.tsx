"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface Enfant {
  id: string;
  nom: string;
}

interface EnfantSelectorProps {
  enfants: Enfant[];
  selectedId: string;
}

// Purement décoratif — distingue visuellement les enfants dans le sélecteur, cycle si >5.
const COULEURS_POINT = ["bg-blue-500", "bg-amber-500", "bg-emerald-500", "bg-purple-500", "bg-rose-500"];

/** Sélecteur multi-enfants (§2.2.1) — persiste le choix via Parent.dernierEleveConsulteId. */
export function EnfantSelector({ enfants, selectedId }: EnfantSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (enfants.length <= 1) {
    return <p className="text-lg font-bold text-texte">{enfants[0]?.nom ?? ""}</p>;
  }

  function handleChange(eleveId: string) {
    fetch("/api/parent/dernier-enfant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eleveId }),
    }).catch(() => {});
    startTransition(() => {
      router.push(`/parent?eleve=${eleveId}`);
    });
  }

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Choisir un enfant">
      {enfants.map((enfant, index) => {
        const actif = enfant.id === selectedId;
        return (
          <button
            key={enfant.id}
            type="button"
            role="radio"
            aria-checked={actif}
            disabled={isPending}
            onClick={() => handleChange(enfant.id)}
            className={`flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors disabled:opacity-60 ${
              actif ? "border-primary bg-primary-light text-primary" : "border-border bg-surface text-texte"
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${COULEURS_POINT[index % COULEURS_POINT.length]}`} aria-hidden="true" />
            {enfant.nom}
          </button>
        );
      })}
    </div>
  );
}
