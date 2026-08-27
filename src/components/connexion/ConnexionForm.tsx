"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { RoleSwitcher, type Role } from "./RoleSwitcher";
import { EleveLoginForm } from "./EleveLoginForm";
import { ParentLoginForm } from "./ParentLoginForm";
import { ConnexionSidePanel } from "./ConnexionSidePanel";

const PANNEAU: Record<Role, Record<string, { titre: string; description: string; totalDots: number; dotActif: number }>> = {
  ELEVE: {
    default: {
      titre: "Retrouve ton tuteur IA",
      description: "Tes épreuves, tes quiz et tes lacunes t'attendent où que tu sois.",
      totalDots: 1,
      dotActif: 1,
    },
  },
  PARENT: {
    demande: {
      titre: "Suis les progrès de ton enfant",
      description: "Corrections, lacunes, quiz : tout en temps réel depuis ton espace parent.",
      totalDots: 2,
      dotActif: 1,
    },
    verification: {
      titre: "Vérification en un instant",
      description: "Un code envoyé par SMS pour confirmer que c'est bien toi.",
      totalDots: 2,
      dotActif: 2,
    },
  },
};

// Écran public — élève/parent uniquement (fidèle aux maquettes desktop 03/03b).
// La connexion admin vit à part sur /admin/connexion, jamais liée ici (§4.1 CDC).
export function ConnexionForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const [role, setRole] = useState<Role>(roleDepuisFrom(from));
  const [parentEtape, setParentEtape] = useState<"demande" | "verification">("demande");

  const panneau = role === "ELEVE" ? PANNEAU.ELEVE.default : PANNEAU.PARENT[parentEtape];

  return (
    <div className="flex w-full max-w-4xl overflow-hidden rounded-3xl bg-surface shadow-xl md:min-h-[600px]">
      <ConnexionSidePanel {...panneau} />

      <div className="flex-1 p-6 sm:p-10 md:p-12">
        <RoleSwitcher
          value={role}
          onChange={(next) => {
            setRole(next);
            setParentEtape("demande");
          }}
        />
        {role === "ELEVE" && <EleveLoginForm from={from} />}
        {role === "PARENT" && <ParentLoginForm from={from} onEtapeChange={setParentEtape} />}
      </div>
    </div>
  );
}

function roleDepuisFrom(from: string | null): Role {
  if (from?.startsWith("/parent")) return "PARENT";
  return "ELEVE";
}
