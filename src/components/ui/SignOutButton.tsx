"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconSignOut } from "@/components/icons";

/**
 * Déconnexion — jusqu'ici absente de l'app (aucune route ni bouton ne
 * l'implémentait, quel que soit le rôle) : sans elle, un même appareil ne
 * peut jamais repartir d'un état réellement anonyme sans que l'utilisateur
 * efface lui-même ses cookies. `redirect: false` + navigation manuelle pour
 * garder le contrôle de la destination (toujours "/", jamais une page qui
 * regate immédiatement vers /connexion en boucle) ; `router.refresh()` vide
 * le cache client du Router App pour qu'aucune page déjà visitée pendant
 * la session ne reste affichée comme si elle l'était encore.
 */
export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);

  async function handleClick() {
    setEnCours(true);
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleClick} disabled={enCours} className={className}>
      <IconSignOut className="h-5 w-5" aria-hidden="true" />
      {enCours ? "Déconnexion..." : "Se déconnecter"}
    </button>
  );
}
