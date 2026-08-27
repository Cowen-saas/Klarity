import { KlarityLogo } from "@/components/ui/KlarityLogo";

const CONTENU_PAR_ETAPE: Record<number, { titre: string; description: string }> = {
  1: {
    titre: "Comment tu t'appelles ?",
    description: "On l'utilisera pour personnaliser ton expérience.",
  },
  2: {
    titre: "Quelques infos pour personnaliser ton parcours",
    description: "On adapte les matières, les épreuves et les quiz à ta classe et ta filière.",
  },
  3: {
    titre: "Ton compte, ta sécurité",
    description: "Un code secret à 4 chiffres, rien de plus, pour te reconnecter en un instant.",
  },
  4: {
    titre: "Bienvenue dans Klarity",
    description: "Ton parent pourra suivre tes progrès avec le code élève ci-contre.",
  },
};

/** Panneau sombre de l'inscription desktop — masqué sur mobile (le flux mobile reste la carte seule). */
export function InscriptionSidePanel({ step, total }: { step: number; total: number }) {
  const contenu = CONTENU_PAR_ETAPE[step] ?? CONTENU_PAR_ETAPE[1];

  return (
    <div className="hidden w-80 shrink-0 flex-col justify-between bg-[#0e1512] p-8 text-white md:flex">
      <KlarityLogo wordmark="Klarity" />

      <div>
        <h2 className="text-3xl leading-tight font-extrabold text-white">{contenu.titre}</h2>
        <p className="mt-4 text-base leading-relaxed text-white/60">{contenu.description}</p>
      </div>

      <div className="flex gap-2" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-full ${i + 1 === step ? "bg-primary" : "bg-white/20"}`} />
        ))}
      </div>
    </div>
  );
}
