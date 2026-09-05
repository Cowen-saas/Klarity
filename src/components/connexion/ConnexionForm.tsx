"use client";

import { useState } from "react";
import Link from "next/link";
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
  const roleParam = searchParams.get("role");
  const sessionExpiree = searchParams.get("raison") === "expiree";

  // Destination réservée à l'élève (banque d'épreuves via le lien "Épreuves" de
  // la landing, ou toute page /eleve/* d'où le middleware renvoie ici) : un
  // parent ne peut de toute façon jamais y accéder. Dans ce cas on n'affiche pas
  // du tout le sélecteur Élève/Parent — l'option Parent est retirée (pas juste
  // grisée), et l'unique option "Élève" est centrée.
  const eleveUniquement = from?.startsWith("/eleve") ?? false;

  const roleVerrouille = roleParam === "PARENT" || roleParam === "ELEVE";
  const [role, setRole] = useState<Role>(
    eleveUniquement ? "ELEVE" : roleVerrouille ? roleParam : roleDepuisFrom(from)
  );
  const [parentEtape, setParentEtape] = useState<"demande" | "verification">("demande");

  const panneau = role === "ELEVE" ? PANNEAU.ELEVE.default : PANNEAU.PARENT[parentEtape];

  // Bannière "besoin d'un compte" (avec lien inscription) affichée quand on arrive
  // depuis un point d'entrée public qui suppose un compte — abonnement (§2.6) ou
  // l'espace élève (ex. lien "Épreuves" de la landing → /connexion?from=/eleve/epreuves).
  const contexte: "abonnement" | "eleve" | null = from?.startsWith("/abonnement")
    ? "abonnement"
    : from?.startsWith("/eleve")
      ? "eleve"
      : null;
  const messageEleve =
    contexte === "abonnement"
      ? "Connecte-toi pour continuer ton abonnement."
      : from?.startsWith("/eleve/epreuves")
        ? "Connecte-toi pour accéder à la banque d'épreuves."
        : "Connecte-toi pour accéder à ton espace élève.";

  return (
    <div className="flex w-full max-w-4xl overflow-hidden rounded-3xl bg-surface shadow-xl md:min-h-[600px]">
      <ConnexionSidePanel {...panneau} />

      <div className="flex-1 p-6 sm:p-10 md:p-12">
        {sessionExpiree && (
          <div className="mb-6 rounded-xl border border-accent/30 bg-accent-light px-4 py-3 text-sm text-texte">
            <p className="font-semibold">Ta session a expiré.</p>
            <p className="mt-1 text-texte-muted">Reconnecte-toi pour reprendre là où tu en étais.</p>
          </div>
        )}
        {/* Une session qui vient d'expirer implique déjà un compte existant — la
            bannière "besoin d'un compte" (avec lien inscription) serait à côté
            de la plaque, donc on la tait dans ce cas. */}
        {contexte && !sessionExpiree && (
          <div className="mb-6 rounded-xl bg-primary-light px-4 py-3 text-sm text-texte">
            {role === "ELEVE" ? (
              <>
                <p className="font-semibold">{messageEleve}</p>
                <p className="mt-1 text-texte-muted">
                  Pas encore de compte ?{" "}
                  <Link href="/inscription" className="font-semibold text-primary hover:underline">
                    Inscris-toi
                  </Link>
                  .
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">Connecte-toi avec le code élève transmis par ton enfant.</p>
                <p className="mt-1 text-texte-muted">
                  Ton enfant n&apos;a pas encore de compte ?{" "}
                  <Link href="/inscription" className="font-semibold text-primary hover:underline">
                    Crée d&apos;abord son compte élève
                  </Link>
                  .
                </p>
              </>
            )}
          </div>
        )}
        {eleveUniquement ? (
          <div className="mb-6 flex justify-center">
            <span className="rounded-full bg-primary px-8 py-2 text-sm font-semibold text-white">Élève</span>
          </div>
        ) : (
          <RoleSwitcher
            value={role}
            locked={roleVerrouille}
            onChange={(next) => {
              setRole(next);
              setParentEtape("demande");
            }}
          />
        )}
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
