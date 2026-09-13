import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/**
 * Uniquement les pages publiques pertinentes pour l'indexation — jamais les
 * dashboards authentifiés (/eleve, /parent, /admin), qui ne doivent pas être
 * découvrables publiquement (voir `robots.ts`). Génération native Next.js
 * (`app/sitemap.ts`) plutôt qu'un fichier statique : reste à jour
 * automatiquement, sans étape manuelle, si cette liste évolue.
 */
const PAGES_PUBLIQUES: Array<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/inscription", changeFrequency: "monthly", priority: 0.8 },
  { path: "/abonnement", changeFrequency: "monthly", priority: 0.7 },
  { path: "/connexion", changeFrequency: "monthly", priority: 0.5 },
  { path: "/mentions-legales", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cgu", changeFrequency: "yearly", priority: 0.3 },
  { path: "/confidentialite", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES_PUBLIQUES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
