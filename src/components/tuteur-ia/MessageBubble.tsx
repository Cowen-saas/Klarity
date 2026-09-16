import { VideoCard } from "@/components/video/VideoCard";

interface MessageBubbleProps {
  role: "ELEVE" | "ASSISTANT";
  contenu: string;
  video?: { titre: string; providerVideoId: string } | null;
}

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
      <p
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          estEleve ? "bg-primary text-white" : "bg-fond text-texte"
        }`}
      >
        {contenu}
      </p>
      {video && (
        <div className="w-full max-w-[80%]">
          <VideoCard titre={video.titre} providerVideoId={video.providerVideoId} />
        </div>
      )}
    </div>
  );
}
