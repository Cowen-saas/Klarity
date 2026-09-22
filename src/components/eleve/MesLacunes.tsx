"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { IconCheckCircle, IconWarning, IconPencil, IconPlay } from "@/components/icons";
import { VideoCard } from "@/components/video/VideoCard";

const INTERVALLE_SONDAGE_MS = 2000;

interface VideoVue {
  titre: string;
  providerVideoId: string;
  dureeSecondes: number | null;
}

interface LacuneVue {
  id: string;
  notion: string;
  matiere: string;
  niveauMaitrise: number;
  explication: string | null;
  videos: VideoVue[];
}

type Statut = "bon" | "moyen" | "faible";

function statutDe(niveau: number): Statut {
  if (niveau >= 70) return "bon";
  if (niveau >= 40) return "moyen";
  return "faible";
}

const BARRE_PAR_STATUT: Record<Statut, string> = {
  bon: "bg-success",
  moyen: "bg-accent",
  faible: "bg-danger",
};

const TEXTE_PAR_STATUT: Record<Statut, string> = {
  bon: "text-success",
  moyen: "text-accent",
  faible: "text-danger",
};

function IndicateurStatut({ statut }: { statut: Statut }) {
  if (statut === "bon") return <IconCheckCircle className="h-4 w-4 text-success" weight="fill" aria-hidden="true" />;
  if (statut === "moyen") return <IconWarning className="h-4 w-4 text-accent" weight="fill" aria-hidden="true" />;
  return <span className="inline-block h-3 w-3 rounded-full bg-danger" aria-hidden="true" />;
}

/**
 * "Mes lacunes par matière" (maquette 09). Grille de cartes par matière,
 * chacune listant ses notions avec une barre de progression colorée par
 * seuil (≥70 vert, 40-69 ambre, <40 rouge) ; un clic sélectionne la notion
 * dans le panneau de détail ci-dessous (sélection initiale : la lacune la
 * plus faible, comme dans la maquette).
 */
export function MesLacunes({ lacunes }: { lacunes: LacuneVue[] }) {
  const router = useRouter();
  const [selectionId, setSelectionId] = useState<string | null>(lacunes[0]?.id ?? null);
  const selection = lacunes.find((l) => l.id === selectionId) ?? null;
  const [generationEnCours, setGenerationEnCours] = useState<string | null>(null); // lacuneId en cours de génération
  const [erreurQuiz, setErreurQuiz] = useState<string | null>(null);

  useEffect(() => {
    if (!generationEnCours) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/eleve/quiz/cible?lacuneId=${generationEnCours}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.quiz) {
          router.push(`/eleve/quiz/${data.quiz.id}`);
        }
      } catch {
        // silencieux — la prochaine itération réessaiera
      }
    }, INTERVALLE_SONDAGE_MS);
    return () => clearInterval(interval);
  }, [generationEnCours, router]);

  async function commencerQuizCible(lacuneId: string) {
    setErreurQuiz(null);
    try {
      const res = await apiFetch("/api/eleve/quiz/cible", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lacuneId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErreurQuiz(data.error ?? "Génération impossible.");
        return;
      }
      setGenerationEnCours(lacuneId);
    } catch {
      setErreurQuiz("Impossible de contacter le serveur.");
    }
  }

  const parMatiere = useMemo(() => {
    const groupes = new Map<string, LacuneVue[]>();
    for (const l of lacunes) {
      const liste = groupes.get(l.matiere) ?? [];
      liste.push(l);
      groupes.set(l.matiere, liste);
    }
    return Array.from(groupes.entries());
  }, [lacunes]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-texte">Mes lacunes par matière</h1>

      {lacunes.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl bg-surface px-6 py-12 text-center shadow-sm">
          <IconCheckCircle className="h-8 w-8 text-success" weight="fill" aria-hidden="true" />
          <h2 className="mt-2 text-base font-bold text-texte">Aucune lacune active pour l&apos;instant</h2>
          <p className="max-w-md text-sm text-texte-muted">
            Envoie une copie pour une épreuve corrigée, ou fais un quiz — tes lacunes apparaîtront ici dès qu&apos;elles seront détectées.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {parMatiere.map(([matiere, items]) => (
              <div key={matiere} className="rounded-2xl bg-surface p-5 shadow-sm">
                <h2 className="text-base font-bold text-texte">{matiere}</h2>
                <div className="mt-3 space-y-3">
                  {items.map((l) => {
                    const statut = statutDe(l.niveauMaitrise);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setSelectionId(l.id)}
                        className={`block w-full rounded-lg text-left transition-opacity ${
                          selectionId === l.id ? "" : "opacity-90 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-texte">{l.notion}</span>
                          <span className={`flex items-center gap-1.5 font-bold ${TEXTE_PAR_STATUT[statut]}`}>
                            {l.niveauMaitrise}% <IndicateurStatut statut={statut} />
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-fond">
                          <div
                            className={`h-full rounded-full ${BARRE_PAR_STATUT[statut]}`}
                            style={{ width: `${Math.max(2, l.niveauMaitrise)}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {selection && (
            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,28rem)_1fr] lg:items-start">
              <div className="rounded-2xl bg-surface p-6 shadow-sm">
                <h2 className="text-lg font-bold text-texte">{selection.notion}</h2>
                <p className={`mt-1 flex items-center gap-1.5 text-sm font-bold ${TEXTE_PAR_STATUT[statutDe(selection.niveauMaitrise)]}`}>
                  {selection.niveauMaitrise}% de maîtrise <IndicateurStatut statut={statutDe(selection.niveauMaitrise)} />
                </p>
                {selection.explication && <p className="mt-3 text-sm text-texte-muted">{selection.explication}</p>}

                {erreurQuiz && (
                  <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-danger">
                    <IconWarning className="h-4 w-4" weight="fill" aria-hidden="true" />
                    {erreurQuiz}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => commencerQuizCible(selection.id)}
                  disabled={generationEnCours !== null}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
                >
                  {generationEnCours === selection.id ? (
                    "Préparation du quiz…"
                  ) : (
                    <>
                      <IconPencil className="h-4 w-4" aria-hidden="true" />
                      Commencer le quiz associé
                    </>
                  )}
                </button>
              </div>

              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-lg font-bold text-texte">Vidéos recommandées</h2>
                  {selection.videos.length > 0 && (
                    <span className="shrink-0 text-xs font-semibold text-texte-muted">
                      {selection.videos.length} vidéo{selection.videos.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-texte-muted">Pour progresser sur « {selection.notion} »</p>

                {selection.videos.length > 0 ? (
                  <div className="mt-4 flex flex-col gap-4">
                    {selection.videos.map((v) => (
                      <VideoCard
                        key={v.providerVideoId}
                        titre={v.titre}
                        providerVideoId={v.providerVideoId}
                        dureeSecondes={v.dureeSecondes}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-6 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light">
                      <IconPlay className="h-4 w-4 text-primary" weight="fill" aria-hidden="true" />
                    </span>
                    <p className="text-sm font-semibold text-texte">Aucune vidéo disponible pour l&apos;instant</p>
                    <p className="max-w-xs text-sm text-texte-muted">
                      On cherche encore la meilleure ressource pour cette notion — reviens un peu plus tard.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
