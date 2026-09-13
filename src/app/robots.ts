import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/**
 * Cohérent avec `sitemap.ts` : autorise l'indexation des pages publiques,
 * interdit celle des dashboards authentifiés (gate de rôle appliqué par
 * `middleware.ts` sur ces mêmes préfixes) et des routes API.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/eleve", "/parent", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
