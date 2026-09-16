"use client";

import { useState } from "react";
import { IconPlay } from "@/components/icons";

/**
 * Carte vidéo recommandée (§2.5) — composant réutilisable partagé entre
 * "Mes lacunes" (maquette 09) et le chat-tuteur (maquette 05, Passe 3).
 * Miniature réelle YouTube (`i.ytimg.com`, pas d'appel API supplémentaire)
 * avec superposition "lecture" ; le lecteur `youtube-nocookie.com` n'est
 * monté qu'après un clic explicite de l'élève — jamais de cookie de suivi
 * avant interaction (§3, §4.2, public mineur).
 */
export function VideoCard({ titre, providerVideoId }: { titre: string; providerVideoId: string }) {
  const [enLecture, setEnLecture] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-sm">
      <div className="relative aspect-video w-full bg-fond">
        {enLecture ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${providerVideoId}?autoplay=1`}
            title={titre}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEnLecture(true)}
            aria-label={`Lire la vidéo : ${titre}`}
            className="group absolute inset-0 h-full w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- miniature YouTube externe, jamais optimisable via next/image */}
            <img
              src={`https://i.ytimg.com/vi/${providerVideoId}/hqdefault.jpg`}
              alt=""
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 bg-black/10 transition-colors group-hover:bg-black/25" aria-hidden="true" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-lg transition-transform group-hover:scale-110">
                <IconPlay className="h-7 w-7 translate-x-0.5 text-primary" weight="fill" aria-hidden="true" />
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="p-4">
        <p className="text-[11px] font-bold tracking-wide text-primary uppercase">Vidéo recommandée</p>
        <p className="mt-1 text-sm font-bold text-texte">{titre}</p>
      </div>
    </div>
  );
}
