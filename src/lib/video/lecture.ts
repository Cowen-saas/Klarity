import { prisma } from "@/lib/prisma";

/**
 * Lecture seule du cache vidéo (§2.5) — jamais un nouvel appel YouTube/Haiku
 * ici (§3, pas d'appel IA/réseau externe synchrone dans une route). Partagé
 * entre l'écran "Mes lacunes" et le chat-tuteur (recommandation inline,
 * Passe 3) pour résoudre `LacuneVideoCache`/`Video` par notion.
 */

export interface VideoVue {
  titre: string;
  providerVideoId: string;
  dureeSecondes: number | null;
}

/**
 * Pour chaque notion fournie, résout toutes les vidéos retenues par le pipeline
 * (jusqu'à 3, cf. `filtrerVideos` — ordre de pertinence Haiku préservé, pas
 * l'ordre SQL). Utilisé par "Mes lacunes" (plusieurs recommandations affichées).
 */
export async function resoudreVideosParNotion(notions: string[]): Promise<Map<string, VideoVue[]>> {
  const resultat = new Map<string, VideoVue[]>();
  if (notions.length === 0) return resultat;

  const caches = await prisma.lacuneVideoCache.findMany({
    where: { notionCle: { in: notions } },
    select: { notionCle: true, videoIdsJson: true },
  });
  const idsParNotion = new Map(caches.map((c) => [c.notionCle, c.videoIdsJson as string[]]));
  const tousLesIds = [...idsParNotion.values()].flat();
  if (tousLesIds.length === 0) return resultat;

  const videos = await prisma.video.findMany({
    where: { id: { in: tousLesIds } },
    select: { id: true, titre: true, providerVideoId: true, dureeSecondes: true },
  });
  const videoParId = new Map(videos.map((v) => [v.id, v]));

  for (const [notion, ids] of idsParNotion) {
    const vues = ids
      .map((id) => videoParId.get(id))
      .filter((v): v is NonNullable<typeof v> => v !== undefined)
      .map((v) => ({ titre: v.titre, providerVideoId: v.providerVideoId, dureeSecondes: v.dureeSecondes }));
    if (vues.length > 0) resultat.set(notion, vues);
  }
  return resultat;
}

/** Pour chaque notion fournie, résout uniquement la 1ère vidéo retenue (chat-tuteur, recommandation inline unique). */
export async function resoudrePremiereVideoParNotion(notions: string[]): Promise<Map<string, VideoVue>> {
  const toutes = await resoudreVideosParNotion(notions);
  const resultat = new Map<string, VideoVue>();
  for (const [notion, videos] of toutes) {
    if (videos[0]) resultat.set(notion, videos[0]);
  }
  return resultat;
}
