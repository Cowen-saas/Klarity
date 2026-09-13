/**
 * URL publique canonique du site, utilisée par `sitemap.ts` et `robots.ts`
 * pour générer des URLs absolues. `VERCEL_PROJECT_PRODUCTION_URL` est injecté
 * automatiquement par Vercel (stable, contrairement à `VERCEL_URL` qui varie
 * par déploiement de preview) — pas de configuration manuelle requise en
 * production. `NEXT_PUBLIC_SITE_URL` reste un override optionnel si le
 * domaine change (domaine personnalisé, par ex.).
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://klarity-sand.vercel.app");
