import Link from "next/link";

/**
 * Pagination serveur (§ scalability : « paginer chaque endpoint de liste »).
 * Rendue en `<Link>` pour rester un Server Component — la page relit
 * simplement `?page=` au prochain rendu. `baseParams` conserve les autres
 * filtres actifs (ex. `?type=` sur l'écran Sécurité).
 */
export function Pagination({
  page,
  totalPages,
  basePath,
  baseParams,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  baseParams?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  function href(cible: number): string {
    const params = new URLSearchParams();
    for (const [cle, valeur] of Object.entries(baseParams ?? {})) {
      if (valeur) params.set(cle, valeur);
    }
    if (cible > 1) params.set("page", String(cible));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const precedent = Math.max(1, page - 1);
  const suivant = Math.min(totalPages, page + 1);

  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <Link
        href={href(precedent)}
        aria-disabled={page === 1}
        tabIndex={page === 1 ? -1 : undefined}
        className={`rounded-xl border-2 border-border px-3 py-1.5 font-semibold transition-colors ${
          page === 1 ? "pointer-events-none text-texte-muted/40" : "text-texte hover:border-primary/40"
        }`}
      >
        ← Précédent
      </Link>
      <p className="text-texte-muted">
        Page <span className="font-semibold text-texte">{page}</span> sur {totalPages}
      </p>
      <Link
        href={href(suivant)}
        aria-disabled={page === totalPages}
        tabIndex={page === totalPages ? -1 : undefined}
        className={`rounded-xl border-2 border-border px-3 py-1.5 font-semibold transition-colors ${
          page === totalPages ? "pointer-events-none text-texte-muted/40" : "text-texte hover:border-primary/40"
        }`}
      >
        Suivant →
      </Link>
    </nav>
  );
}

/** Normalise `?page=` (entier ≥ 1, borné au nombre de pages). */
export function lirePage(valeur: string | string[] | undefined, totalPages: number): number {
  const brut = Array.isArray(valeur) ? valeur[0] : valeur;
  const n = Number.parseInt(brut ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, totalPages));
}
