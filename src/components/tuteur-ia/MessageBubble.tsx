interface MessageBubbleProps {
  role: "ELEVE" | "ASSISTANT";
  contenu: string;
}

export function MessageBubble({ role, contenu }: MessageBubbleProps) {
  const estEleve = role === "ELEVE";
  return (
    <div className={`flex ${estEleve ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          estEleve ? "bg-primary text-white" : "bg-fond text-texte"
        }`}
      >
        {contenu}
      </p>
    </div>
  );
}
