"use client";

import { useState } from "react";
import { IconPlay, IconClock } from "@/components/icons";

/** "PT" côté API déjà converti en secondes -> "4:13" / "1:02:10". */
function formatDuree(secondes: number): string {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = Math.floor(secondes % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Carte vidéo recommandée (§2.5) — composant réutilisable partagé entre
 * "Mes lacunes" (maquette 09) et le chat-tuteur (maquette 05, Passe 3).
 * Miniature réelle YouTube (`i.ytimg.com`, pas d'appel API supplémentaire)
 * avec superposition "lecture" et badge de durée ; le lecteur
 * `youtube-nocookie.com` n'est monté qu'après un clic explicite de l'élève —
 * jamais de cookie de suivi avant interaction (§3, §4.2, public mineur).
 */
export function VideoCard({
  titre,
  providerVideoId,
  dureeSecondes,
}: {
  titre: string;
  providerVideoId: string;
  dureeSecondes?: number | null;
}) {
  const [enLecture, setEnLecture] = useState(false);

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-border/60 transition-shadow hover:shadow-md">
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
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-lg transition-transform group-hover:scale-110 sm:h-16 sm:w-16">
                <IconPlay className="h-6 w-6 translate-x-0.5 text-primary sm:h-7 sm:w-7" weight="fill" aria-hidden="true" />
              </span>
            </span>
            {typeof dureeSecondes === "number" && (
              <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                <IconClock className="h-3 w-3" aria-hidden="true" />
                {formatDuree(dureeSecondes)}
              </span>
            )}
          </button>
        )}
      </div>
      <div className="p-4">
        <p className="text-[11px] font-bold tracking-wide text-primary uppercase">Vidéo recommandée</p>
        <p className="mt-1 line-clamp-2 text-sm font-bold text-texte">{titre}</p>
      </div>
    </div>
  );
}
