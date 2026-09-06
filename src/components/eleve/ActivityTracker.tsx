"use client";

import { useEffect, useRef } from "react";

/**
 * Mesure le temps réellement passé par l'élève sur la plateforme web (§4.3,
 * `SessionActivite`), pour le tableau de bord parent « Temps passé ».
 *
 * Principe (cf. mémoire projet sur la session, §29/§30) : **jamais un minuteur
 * aveugle**. Le temps ne s'accumule que si le compteur a vu une *vraie*
 * interaction (clic, touche, scroll, retour de focus sur l'onglet) dans les
 * `INACTIVITE_MS` dernières millisecondes **et** que l'onglet est visible. Un
 * onglet oublié ouvert cesse de compter au bout d'une minute ; un onglet en
 * arrière-plan ne compte pas du tout.
 *
 * Le temps accumulé est envoyé par `navigator.sendBeacon` (résiste à la
 * fermeture d'onglet) à chaque passage en arrière-plan / fermeture, plus un
 * envoi de sécurité périodique. Le serveur re-plafonne de toute façon (payload
 * client = non fiable) : borne par envoi + plafond quotidien.
 */

const TICK_MS = 5_000; // granularité d'accumulation
const INACTIVITE_MS = 60_000; // au-delà, l'élève est considéré absent
const FLUSH_MS = 60_000; // envoi de sécurité pendant l'activité
const MIN_ENVOI_S = 5; // n'envoie pas des miettes
const MAX_ACCUMULE_MS = 15 * 60_000; // force un envoi bien avant que ça enfle

export function ActivityTracker() {
  const derniereInteraction = useRef(Date.now());
  const accumuleMs = useRef(0);

  useEffect(() => {
    const marquerInteraction = () => {
      derniereInteraction.current = Date.now();
    };

    const envoyer = () => {
      const secondes = Math.round(accumuleMs.current / 1000);
      if (secondes < MIN_ENVOI_S) return;
      accumuleMs.current = 0;
      const corps = JSON.stringify({ dureeSecondes: secondes });
      const ok =
        typeof navigator.sendBeacon === "function" &&
        navigator.sendBeacon("/api/eleve/activite", new Blob([corps], { type: "application/json" }));
      if (!ok) {
        // Repli : fetch keepalive (sendBeacon indisponible ou file pleine).
        fetch("/api/eleve/activite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: corps,
          keepalive: true,
        }).catch(() => {});
      }
    };

    const tick = () => {
      // Accumulation à pas fixe : chaque tick « actif » vaut exactement TICK_MS,
      // jamais l'écart réel entre deux ticks (un timer en retard — onglet
      // réveillé, machine sortie de veille — ne peut donc pas gonfler le temps).
      const actif =
        document.visibilityState === "visible" && Date.now() - derniereInteraction.current < INACTIVITE_MS;
      if (actif) {
        accumuleMs.current += TICK_MS;
        if (accumuleMs.current >= MAX_ACCUMULE_MS) envoyer();
      }
    };

    const surVisibilite = () => {
      if (document.visibilityState === "hidden") {
        envoyer();
      } else {
        // Retour volontaire sur l'onglet = signal d'activité (un onglet oublié
        // ne déclenche pas cet événement).
        derniereInteraction.current = Date.now();
      }
    };

    const evenements: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "scroll", "wheel", "touchstart"];
    for (const e of evenements) window.addEventListener(e, marquerInteraction, { passive: true });
    window.addEventListener("focus", marquerInteraction);
    document.addEventListener("visibilitychange", surVisibilite);
    window.addEventListener("pagehide", envoyer);

    const idTick = window.setInterval(tick, TICK_MS);
    const idFlush = window.setInterval(envoyer, FLUSH_MS);

    return () => {
      for (const e of evenements) window.removeEventListener(e, marquerInteraction);
      window.removeEventListener("focus", marquerInteraction);
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("pagehide", envoyer);
      window.clearInterval(idTick);
      window.clearInterval(idFlush);
      envoyer();
    };
  }, []);

  return null;
}
