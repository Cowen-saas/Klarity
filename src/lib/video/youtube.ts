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
