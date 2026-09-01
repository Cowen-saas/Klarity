"use client";

import "./globals.css";

/**
 * Filet de sécurité pour une erreur non rattrapée dans le layout racine lui-
 * même. Doit fournir ses propres `<html>`/`<body>` puisqu'il remplace le
 * layout racine (convention Next.js).
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col items-center justify-center bg-fond px-4 py-10 text-center font-sans antialiased">
        <h1 className="text-xl font-bold text-texte">Une erreur est survenue</h1>
        <p className="mt-2 max-w-sm text-sm text-texte-muted">
          Un problème inattendu s&apos;est produit. Réessaie dans un instant.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
