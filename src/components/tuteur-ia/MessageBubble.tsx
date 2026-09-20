import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { VideoCard } from "@/components/video/VideoCard";

interface MessageBubbleProps {
  role: "ELEVE" | "ASSISTANT";
  contenu: string;
  video?: { titre: string; providerVideoId: string } | null;
}

/**
 * Rendu Markdown (GFM — tableaux, listes à cocher, etc.) des réponses de
 * l'assistant uniquement : le contenu élève reste du texte brut affiché tel
 * quel (whitespace-pre-wrap), jamais interprété comme Markdown — un élève
 * qui tape "# question" ne doit pas se retrouver avec un titre. Stylé à la
 * main via les `components` de react-markdown plutôt qu'un plugin
 * typography générique, pour coller exactement aux tokens de couleur du
 * design system existant (`--color-texte`, `--color-primary`, etc.) au lieu
 * de la palette grise par défaut de Tailwind.
 */
const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  h1: ({ children }) => <h1 className="mt-3 mb-1.5 text-base font-bold text-texte first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-3 mb-1.5 text-[15px] font-bold text-texte first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-2.5 mb-1 text-sm font-bold text-texte first:mt-0">{children}</h3>,
  strong: ({ children }) => <strong className="font-bold text-texte">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary-dark">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-primary/40 pl-3 text-texte-muted italic last:mb-0">{children}</blockquote>
  ),
  hr: () => <hr className="my-2 border-border" />,
  code: ({ children, className }) => {
    // Bloc de code (```...```) : `className` porte "language-xxx" posé par remark ; inline sinon.
    const estBloc = Boolean(className);
    if (estBloc) {
      return <code className="font-mono text-[13px]">{children}</code>;
    }
    return <code className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-[13px]">{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg bg-black/[0.06] p-2.5 last:mb-0">{children}</pre>
  ),
  // Tableaux GFM : scroll horizontal dédié sur mobile plutôt qu'un débordement
  // de page, même pattern que les tableaux admin (`overflow-x-auto` + largeur
  // minimale sur la table interne, cf. audit responsive admin).
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto rounded-lg border border-border last:mb-0">
      <table className="w-full min-w-[360px] border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-black/[0.04]">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-2.5 py-1.5 text-left font-semibold text-texte">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-border px-2.5 py-1.5 text-texte">{children}</td>,
};

/**
 * Bloc "vidéo recommandée" (§2.5, Passe 3, maquette 05) — inline sous la
 * réponse de l'assistant, jamais dans la bulle elle-même (média, pas texte).
 * `video` n'est fourni que pour les messages ASSISTANT, cf.
 * `resoudreVideosPourMessages` (correspondance déterministe texte/notion).
 */
export function MessageBubble({ role, contenu, video }: MessageBubbleProps) {
  const estEleve = role === "ELEVE";
  return (
    <div className={`flex flex-col gap-2 ${estEleve ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          estEleve ? "bg-primary text-white" : "bg-fond text-texte"
        }`}
      >
        {estEleve ? (
          <p className="whitespace-pre-wrap">{contenu}</p>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {contenu}
          </ReactMarkdown>
        )}
      </div>
      {video && (
        <div className="w-full max-w-[80%]">
          <VideoCard titre={video.titre} providerVideoId={video.providerVideoId} />
        </div>
      )}
    </div>
  );
}
