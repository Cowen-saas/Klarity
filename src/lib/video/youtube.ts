import type { VideoCandidate } from "@/lib/ai";

/**
 * Intégration YouTube Data API v3 réelle (§2.5) — recherche uniquement, jamais
 * de credentials OAuth : `YOUTUBE_API_KEY` (clé publique API, déjà validée par
 * un appel de recherche réel, cf. docs/PROGRESS.md §20). `safeSearch: strict`
 * et `videoEmbeddable: true` sont non-négociables ici — public mineur (§3) et
 * lecture exclusivement via `<iframe>` embarquée (§4.2), jamais de lien externe.
 * `relevanceLanguage: fr` uniquement pour l'instant (langue FR, §2.5) —
 * l'extension anglophone viendra avec la Phase Langue (v2).
 */

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const MAX_RESULTATS_BRUTS = 8;

interface YoutubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
  };
}

interface YoutubeSearchResponse {
  items: YoutubeSearchItem[];
}

function decodeHtmlEntities(texte: string): string {
  return texte
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function construireRequeteRecherche(params: {
  notion: string;
  matiere: string;
  classe: string;
  filiere?: string | null;
}): string {
  const { notion, matiere, classe, filiere } = params;
  return `${notion} ${matiere} ${classe}${filiere ? ` ${filiere}` : ""} cours exercice explication`;
}

export async function rechercherVideosYoutube(query: string): Promise<VideoCandidate[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("Configuration YouTube incomplète : YOUTUBE_API_KEY manquante (cf. .env.example section vidéo).");
  }

  const url = new URL(YOUTUBE_SEARCH_URL);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(MAX_RESULTATS_BRUTS));
  url.searchParams.set("relevanceLanguage", "fr");
  url.searchParams.set("safeSearch", "strict");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const corps = await res.text().catch(() => "");
    throw new Error(`Échec recherche YouTube (${res.status}) : ${corps.slice(0, 500)}`);
  }

  const data = (await res.json()) as YoutubeSearchResponse;
  return (data.items ?? [])
    .filter((item) => item.id?.videoId)
    .map((item) => ({
      videoId: item.id.videoId,
      titre: decodeHtmlEntities(item.snippet.title),
      description: decodeHtmlEntities(item.snippet.description),
      chaineNom: decodeHtmlEntities(item.snippet.channelTitle),
    }));
}

interface YoutubeVideosItem {
  id: string;
  contentDetails: { duration: string }; // ISO 8601, ex. "PT4M13S"
}

interface YoutubeVideosResponse {
  items: YoutubeVideosItem[];
}

/** "PT1H2M10S" -> 3730 (secondes). Repli sur null si le format est inattendu (jamais bloquant). */
function parserDureeIso8601(duree: string): number | null {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duree);
  if (!m) return null;
  const [, h, min, s] = m;
  return (Number(h ?? 0) * 3600) + (Number(min ?? 0) * 60) + Number(s ?? 0);
}

/**
 * Récupère la durée des vidéos *déjà retenues* par le filtrage Haiku (jamais sur
 * les 8 résultats bruts de la recherche) — un seul appel `videos.list` par lot,
 * 1 unité de quota par vidéo au lieu des 100 unités d'un `search.list` (§2.5,
 * coût IA/API sous surveillance, cf. CLAUDE.md). Best-effort : une vidéo dont la
 * durée ne peut pas être récupérée obtient `null`, jamais une erreur bloquante
 * pour le pipeline entier.
 */
export async function recupererDureesVideos(videoIds: string[]): Promise<Map<string, number>> {
  const resultat = new Map<string, number>();
  if (videoIds.length === 0) return resultat;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return resultat;

  const url = new URL(YOUTUBE_VIDEOS_URL);
  url.searchParams.set("part", "contentDetails");
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) return resultat; // best-effort — une carte vidéo sans durée reste utilisable

  const data = (await res.json()) as YoutubeVideosResponse;
  for (const item of data.items ?? []) {
    const secondes = parserDureeIso8601(item.contentDetails.duration);
    if (secondes !== null) resultat.set(item.id, secondes);
  }
  return resultat;
}
