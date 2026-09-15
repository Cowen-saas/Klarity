"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { IconWarning } from "@/components/icons";

type StatutTentative = "EN_ATTENTE" | "EN_TRAITEMENT" | "TERMINE" | "ERREUR";

interface TentativeVue {
  id: string;
  statut: StatutTentative;
}

interface UploadCopieProps {
  epreuveId: string;
  titre: string;
  matiere: string;
  /** Renseigné si une tentative n°1 est déjà en cours (retour sur la page pendant le traitement). */
  tentativeInitiale: TentativeVue | null;
}

const INTERVALLE_MS = 2000;
const ETAPES_ANALYSE = ["Lecture des pages", "Reconnaissance des réponses", "Comparaison au corrigé..."];
const DUREE_PAR_ETAPE_MS = 4000;

/**
 * Écran d'upload + analyse (maquette 07, §2.1, §4.3). Deux états, jamais
 * affichés côte à côte contrairement à la maquette (qui montre les deux
 * panneaux pour documentation) : le formulaire d'upload, puis — une fois
 * soumis — le panneau "Analyse de ta copie...", sondé côté client jusqu'à ce
 * que le traitement asynchrone (worker BullMQ, jamais d'appel IA inline)
 * aboutisse. La checklist des 3 étapes est purement cosmétique (perception de
 * progression) : le backend n'expose qu'un statut global EN_ATTENTE /
 * EN_TRAITEMENT / TERMINE / ERREUR, pas de sous-étapes réelles.
 */
export function UploadCopie({ epreuveId, titre, matiere, tentativeInitiale }: UploadCopieProps) {
  const router = useRouter();
  const [pages, setPages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [tentative, setTentative] = useState<TentativeVue | null>(tentativeInitiale);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [etapeIndex, setEtapeIndex] = useState(0);
  const inputCameraRef = useRef<HTMLInputElement>(null);
  const inputGalerieRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  function ajouterPages(fichiers: FileList | null) {
    if (!fichiers) return;
    const nouveaux = Array.from(fichiers);
    setPages((p) => [...p, ...nouveaux]);
    setPreviews((p) => [...p, ...nouveaux.map((f) => URL.createObjectURL(f))]);
  }

  function retirerPage(index: number) {
    setPages((p) => p.filter((_, i) => i !== index));
    setPreviews((p) => {
      URL.revokeObjectURL(p[index]);
      return p.filter((_, i) => i !== index);
    });
  }

  async function envoyer() {
    setEnCours(true);
    setErreur(null);
    try {
      const form = new FormData();
      for (const p of pages) form.append("photos", p);
      const res = await apiFetch(`/api/eleve/epreuves/${epreuveId}/tentatives`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.error ?? "Envoi impossible.");
        return;
      }
      setTentative(data.tentative);
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setEnCours(false);
    }
  }

  // Sondage du statut pendant EN_ATTENTE/EN_TRAITEMENT — s'arrête dès que le
  // traitement aboutit (redirection vers la même page, qui affichera alors le
  // résultat) ou échoue.
  useEffect(() => {
    if (!tentative || (tentative.statut !== "EN_ATTENTE" && tentative.statut !== "EN_TRAITEMENT")) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/eleve/epreuves/${epreuveId}/tentatives/latest`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.tentative && data.tentative.id === tentative.id && data.tentative.statut !== tentative.statut) {
          setTentative(data.tentative);
          if (data.tentative.statut === "TERMINE") {
            router.push(`/eleve/epreuves/${epreuveId}/correction`);
            router.refresh();
          }
        }
      } catch {
        // silencieux — la prochaine itération réessaiera
      }
    }, INTERVALLE_MS);
    return () => clearInterval(interval);
  }, [tentative, epreuveId, router]);

  useEffect(() => {
    if (!tentative || tentative.statut !== "EN_TRAITEMENT") return;
    const interval = setInterval(() => {
      setEtapeIndex((i) => Math.min(i + 1, ETAPES_ANALYSE.length - 1));
    }, DUREE_PAR_ETAPE_MS);
    return () => clearInterval(interval);
  }, [tentative]);

  if (tentative && (tentative.statut === "EN_ATTENTE" || tentative.statut === "EN_TRAITEMENT")) {
    return <AnalyseEnCours etapeIndex={etapeIndex} />;
  }

  if (tentative && tentative.statut === "ERREUR") {
    return (
      <div className="w-full rounded-3xl bg-surface p-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger-light text-danger">
          <IconWarning className="h-8 w-8" weight="fill" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-lg font-bold text-texte">L&apos;analyse n&apos;a pas pu aboutir.</h1>
        <p className="mt-1 text-sm text-texte-muted">
          Un problème technique est survenu pendant la correction. Réessaie — ta copie sera bien analysée.
        </p>
        <button
          type="button"
          onClick={() => setTentative(null)}
          className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-surface p-8 shadow-sm">
      <p className="text-base font-bold text-primary">
        {titre} · {matiere}
      </p>
      <h1 className="mt-1 text-3xl font-bold text-texte">Envoie ta copie</h1>

      <div className="mt-6 flex w-full items-center gap-6 rounded-2xl border-2 border-dashed border-border px-8 py-10">
        <button
          type="button"
          onClick={() => inputCameraRef.current?.click()}
          aria-label="Photographier ma copie"
          className="shrink-0 text-5xl leading-none"
        >
          📷
        </button>
        <div className="text-left">
          <button
            type="button"
            onClick={() => inputCameraRef.current?.click()}
            className="block text-lg font-bold text-texte hover:text-primary"
          >
            Photographier ma copie
          </button>
          <button
            type="button"
            onClick={() => inputGalerieRef.current?.click()}
            className="mt-1 text-sm text-texte-muted underline hover:text-primary"
          >
            ou importer depuis la galerie
          </button>
        </div>
        <input
          ref={inputCameraRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          multiple
          onChange={(e) => {
            ajouterPages(e.target.files);
            e.target.value = "";
          }}
          className="sr-only"
        />
        <input
          ref={inputGalerieRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => {
            ajouterPages(e.target.files);
            e.target.value = "";
          }}
          className="sr-only"
        />
      </div>

      {pages.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-3">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => retirerPage(i)}
              title="Retirer cette page"
              className="group relative aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-xl border border-border bg-fond"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previews[i]} alt={`Page ${i + 1}`} className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-[10px] font-semibold text-white">
                p.{i + 1}
              </span>
              <span className="absolute inset-0 hidden items-center justify-center bg-black/50 text-[10px] font-bold text-white group-hover:flex">
                Retirer
              </span>
            </button>
          ))}
        </div>
      )}

      {erreur && (
        <p role="alert" className="mt-4 flex items-center gap-1.5 text-sm text-danger">
          <IconWarning className="h-4 w-4" weight="fill" aria-hidden="true" />
          {erreur}
        </p>
      )}

      <button
        type="button"
        onClick={envoyer}
        disabled={pages.length === 0 || enCours}
        className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
      >
        {enCours ? "Envoi en cours…" : "Envoyer à l'IA"}
      </button>
    </div>
  );
}

function AnalyseEnCours({ etapeIndex }: { etapeIndex: number }) {
  return (
    <div className="w-full rounded-2xl bg-surface p-8 text-center shadow-sm">
      <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-primary-light border-t-primary" aria-hidden="true" />
      <h1 className="mt-5 text-lg font-bold text-texte">Analyse de ta copie...</h1>
      <p className="mt-1 text-sm text-texte-muted">L&apos;IA lit tes réponses et compare avec le corrigé officiel.</p>

      <div className="mt-5 space-y-2 rounded-xl bg-fond p-4 text-left text-sm">
        {ETAPES_ANALYSE.map((etape, i) => (
          <p key={etape} className={`font-semibold ${i < etapeIndex ? "text-success" : i === etapeIndex ? "text-accent" : "text-texte-muted/50"}`}>
            {i < etapeIndex ? "✓" : i === etapeIndex ? "⟳" : "○"} {etape}
          </p>
        ))}
      </div>
    </div>
  );
}
