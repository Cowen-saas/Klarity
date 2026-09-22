import type { NiveauClasse, Filiere } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai";
import { estimerCoutIA } from "@/lib/ai/pricing";
import { planifierRechercheVideo } from "@/lib/queue/video";
import { construireRequeteRecherche, rechercherVideosYoutube, recupererDureesVideos } from "./youtube";

/**
 * Pipeline vidéo automatisé (§2.5) — recherche YouTube -> filtrage Haiku ->
 * cache (`LacuneVideoCache`, mutualisé par notion, jamais par élève). Appelé
 * uniquement depuis le worker BullMQ (file `video`, cf. `src/worker/index.ts`),
 * jamais inline dans une route (§3). Aucune admin UI (§2.3) — entièrement
 * automatisé.
 */

const DUREE_CACHE_MS = 1000 * 60 * 60 * 24 * 90; // 90 jours — valeur par défaut, ajustable sans migration

export interface VideoVue {
  id: string;
  titre: string;
  providerVideoId: string;
  dureeSecondes: number | null;
}

interface ContexteVideo {
  notion: string;
  matiereId: string;
  matiereNom: string;
  classe: NiveauClasse;
  filiere?: Filiere | null;
}

function cacheValide(dateExpiration: Date): boolean {
  return dateExpiration.getTime() > Date.now();
}

async function videosDepuisIds(ids: string[]): Promise<VideoVue[]> {
  if (ids.length === 0) return [];
  const videos = await prisma.video.findMany({ where: { id: { in: ids } } });
  // Préserve l'ordre de pertinence décidé par le filtrage Haiku (videoIdsJson), pas l'ordre SQL.
  return ids.map((id) => videos.find((v) => v.id === id)).filter((v): v is NonNullable<typeof v> => v !== undefined);
}

/**
 * Sert le cache s'il est valide ; sinon exécute réellement le pipeline
 * (YouTube + Haiku), écrit `Video`/`LacuneVideoCache`/`UsageIA.VIDEO_FILTRAGE`,
 * puis retourne les vidéos retenues. Idempotent : deux appels successifs sur
 * la même notion avec un cache déjà valide ne déclenchent aucun nouvel appel
 * réseau.
 */
export async function obtenirVideosPourNotion(ctx: ContexteVideo): Promise<{ videos: VideoVue[]; depuisCache: boolean }> {
  const cache = await prisma.lacuneVideoCache.findUnique({ where: { notionCle: ctx.notion } });
  if (cache && cacheValide(cache.dateExpiration)) {
    return { videos: await videosDepuisIds(cache.videoIdsJson as string[]), depuisCache: true };
  }

  const query = construireRequeteRecherche({ notion: ctx.notion, matiere: ctx.matiereNom, classe: ctx.classe, filiere: ctx.filiere });
  const candidats = await rechercherVideosYoutube(query);

  const videoIds: string[] = [];
  if (candidats.length > 0) {
    const filtrage = await getAIProvider().filtrerVideos(candidats, ctx.notion, ctx.matiereNom);
    const durees = await recupererDureesVideos(filtrage.retenues.map((r) => r.videoId));

    for (const retenue of filtrage.retenues) {
      const dureeSecondes = durees.get(retenue.videoId) ?? null;
      const existante = await prisma.video.findFirst({
        where: { providerVideoId: retenue.videoId, notionAssociee: ctx.notion },
        select: { id: true, dureeSecondes: true },
      });
      if (existante) {
        if (existante.dureeSecondes === null && dureeSecondes !== null) {
          await prisma.video.update({ where: { id: existante.id }, data: { dureeSecondes } });
        }
        videoIds.push(existante.id);
        continue;
      }
      const creee = await prisma.video.create({
        data: {
          titre: retenue.titre,
          providerVideoId: retenue.videoId,
          dureeSecondes,
          matiereId: ctx.matiereId,
          notionAssociee: ctx.notion,
          classe: ctx.classe,
          filiere: ctx.filiere ?? null,
        },
        select: { id: true },
      });
      videoIds.push(creee.id);
    }

    await prisma.usageIA.create({
      data: {
        eleveId: null,
        matiereId: ctx.matiereId,
        typeUsage: "VIDEO_FILTRAGE",
        modele: "HAIKU",
        tokensInput: filtrage.tokensInput,
        tokensOutput: filtrage.tokensOutput,
        coutEstime: estimerCoutIA("HAIKU", filtrage.tokensInput, filtrage.tokensOutput),
      },
    });
  }

  await prisma.lacuneVideoCache.upsert({
    where: { notionCle: ctx.notion },
    create: { notionCle: ctx.notion, videoIdsJson: videoIds, dateExpiration: new Date(Date.now() + DUREE_CACHE_MS) },
    update: { videoIdsJson: videoIds, dateExpiration: new Date(Date.now() + DUREE_CACHE_MS) },
  });

  return { videos: await videosDepuisIds(videoIds), depuisCache: false };
}

/**
 * Compatibilité avec le cycle du quiz journalier (§2.5 point 1) — pour les
 * `Lacune` actives plus anciennes dont la notion n'a encore jamais été
 * traitée (ou dont le cache a expiré), sans attendre une nouvelle correction.
 * Appelé depuis le même tick que le cron quiz journalier (worker).
 */
export async function planifierVideosPourLacunesActives(): Promise<{ planifiees: number }> {
  const lacunes = await prisma.lacune.findMany({
    where: { resolu: false },
    distinct: ["notion", "matiereId"],
    select: {
      notion: true,
      matiereId: true,
      matiere: { select: { nom: true } },
      eleve: { select: { classe: true, filiere: true } },
    },
  });

  const notions = lacunes.map((l) => l.notion);
  const cachesValides = await prisma.lacuneVideoCache.findMany({
    where: { notionCle: { in: notions } },
    select: { notionCle: true, dateExpiration: true },
  });
  const notionsCouvertes = new Set(cachesValides.filter((c) => cacheValide(c.dateExpiration)).map((c) => c.notionCle));

  let planifiees = 0;
  for (const l of lacunes) {
    if (notionsCouvertes.has(l.notion)) continue;
    await planifierRechercheVideo({
      notion: l.notion,
      matiereId: l.matiereId,
      matiereNom: l.matiere.nom,
      classe: l.eleve.classe,
      filiere: l.eleve.filiere,
    });
    planifiees++;
  }
  return { planifiees };
}
