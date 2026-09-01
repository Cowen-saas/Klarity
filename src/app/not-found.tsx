import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page introuvable — Klarity",
};

/**
 * 404 App Router. Sa présence explicite évite aussi que `next build` retombe
 * sur la page d'erreur héritée du Pages Router (qui importe `<Html>` et fait
 * échouer le prérendu de `/404` et `/_error`).
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-fond px-4 py-10 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <h1 className="mt-4 text-xl font-bold text-texte">Cette page n&apos;existe pas</h1>
      <p className="mt-2 max-w-sm text-sm text-texte-muted">
        Le lien est peut-être obsolète, ou l&apos;adresse a été mal saisie.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
