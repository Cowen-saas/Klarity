import { KlarityLogo } from "@/components/ui/KlarityLogo";

interface ConnexionSidePanelProps {
  titre: string;
  description: string;
  totalDots: number;
  dotActif: number;
}

/** Panneau sombre de connexion desktop, même patron que celui de l'inscription. */
export function ConnexionSidePanel({ titre, description, totalDots, dotActif }: ConnexionSidePanelProps) {
  return (
    <div className="hidden w-80 shrink-0 flex-col justify-between bg-[#0e1512] p-8 text-white md:flex">
      <KlarityLogo wordmark="Klarity" />

      <div>
        <h2 className="text-3xl leading-tight font-extrabold text-white">{titre}</h2>
        <p className="mt-4 text-base leading-relaxed text-white/60">{description}</p>
      </div>

      <div className="flex gap-2" aria-hidden="true">
        {Array.from({ length: totalDots }, (_, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-full ${i + 1 === dotActif ? "bg-primary" : "bg-white/20"}`} />
        ))}
      </div>
    </div>
  );
}
