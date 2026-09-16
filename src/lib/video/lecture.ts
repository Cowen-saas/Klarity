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
}

/** Pour chaque notion fournie, résout la 1ère vidéo retenue par le pipeline (ordre de pertinence Haiku). */
export async function resoudrePremiereVideoParNotion(notions: string[]): Promise<Map<string, VideoVue>> {
  const resultat = new Map<string, VideoVue>();
  if (notions.length === 0) return resultat;

  const caches = await prisma.lacuneVideoCache.findMany({
    where: { notionCle: { in: notions } },
    select: { notionCle: true, videoIdsJson: true },
  });
  const premierIdParNotion = new Map(
    caches.map((c) => [c.notionCle, (c.videoIdsJson as string[])[0] as string | undefined])
  );
  const ids = [...premierIdParNotion.values()].filter((id): id is string => Boolean(id));
  if (ids.length === 0) return resultat;

  const videos = await prisma.video.findMany({
    where: { id: { in: ids } },
    select: { id: true, titre: true, providerVideoId: true },
  });
  const videoParId = new Map(videos.map((v) => [v.id, v]));

  for (const [notion, videoId] of premierIdParNotion) {
    const video = videoId ? videoParId.get(videoId) : undefined;
    if (video) resultat.set(notion, { titre: video.titre, providerVideoId: video.providerVideoId });
  }
  return resultat;
}
