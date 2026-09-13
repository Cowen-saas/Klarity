import type { LegalBlock, LegalMeta } from "@/content/legal/types";
import { IconWarning } from "@/components/icons";

/**
 * Rendu générique des documents juridiques (§2.3, §2.9) — Mentions Légales, CGU
 * et Politique de Confidentialité partagent tous les trois cette même structure
 * de blocs (`LegalBlock`, extraite des `.docx` sources, cf. `src/content/legal/`),
 * donc un seul composant de mise en page pour les trois pages plutôt que trois
 * mises en page dupliquées.
 */
export function LegalDocument({ meta, blocks }: { meta: LegalMeta; blocks: LegalBlock[] }) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 sm:px-8 sm:py-16">
      <header className="border-b border-border pb-8">
        <p className="text-xs font-bold tracking-widest text-primary uppercase">{meta.marque}</p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-texte sm:text-4xl">{meta.titre}</h1>
        <p className="mt-3 text-sm text-texte-muted">{meta.sousTitre}</p>
        <p className="mt-1 text-sm text-texte-muted">{meta.complement}</p>
        <p className="mt-4 text-xs font-semibold text-texte-muted">{meta.version}</p>
      </header>

      <div className="mt-10 space-y-5">
        {blocks.map((block, i) => (
          <LegalBlockView key={i} block={block} />
        ))}
      </div>
    </article>
  );
}

function LegalBlockView({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case "h1":
      return <h2 className="mt-10 text-xl font-bold text-texte first:mt-0">{block.text}</h2>;
    case "h2":
      return <h3 className="mt-6 text-base font-bold text-texte">{block.text}</h3>;
    case "p":
      return <p className="text-sm leading-relaxed text-texte-muted">{block.text}</p>;
    case "list":
      return (
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-texte-muted marker:text-primary">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-fond">
                {block.headers.map((h, i) => (
                  <th key={i} className="border-b border-border px-4 py-2.5 font-bold text-texte">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-2.5 align-top text-texte-muted">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "callout":
      return (
        <div className="flex gap-3 rounded-xl border border-accent/30 bg-accent-light px-4 py-3.5">
          <IconWarning className="mt-0.5 h-5 w-5 shrink-0 text-accent" weight="fill" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-texte">{block.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-texte-muted">{block.text}</p>
          </div>
        </div>
      );
  }
}
