import type { ComponentType, SVGProps } from "react";
import { IconCamera, IconRobot, IconBulb, IconPencil } from "@/components/icons";

interface Step {
  numero: number;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  titre: string;
  description: string;
}

/**
 * L'icône robot (étape 2) est réservée à la Correction IA -- cf. CDC §2.1.1 --
 * et ne doit jamais apparaître sur une surface de chat/Tuteur IA (voir
 * TuteurDemoWidget, qui utilise exclusivement le glyphe étoile).
 */
const STEPS: Step[] = [
  {
    numero: 1,
    icon: IconCamera,
    titre: "Photographie ta copie",
    description: "Prends ta copie en photo depuis ton téléphone, page par page.",
  },
  {
    numero: 2,
    icon: IconRobot,
    titre: "Corrigé généré par l'IA",
    description: "L'IA analyse tes réponses et compare avec le corrigé officiel.",
  },
  {
    numero: 3,
    icon: IconBulb,
    titre: "Lacune détectée",
    description: "Les notions mal maîtrisées sont identifiées automatiquement.",
  },
  {
    numero: 4,
    icon: IconPencil,
    titre: "Quiz du jour généré",
    description: "Un quiz personnalisé est créé pour renforcer ta lacune.",
  },
];

export function HowItWorks() {
  return (
    <section id="comment-ca-marche" className="bg-surface py-16">
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <div className="text-center">
          <p className="text-sm font-bold tracking-wide text-primary uppercase">
            Comment ça marche
          </p>
          <h2 className="mt-2 text-2xl font-bold text-texte sm:text-3xl">
            De la copie papier au quiz personnalisé
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.numero} className="rounded-2xl bg-fond p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-serif font-bold text-white">
                  {step.numero}
                </span>
                <Icon className="mt-4 h-6 w-6 text-texte-muted" aria-hidden="true" />
                <h3 className="mt-3 text-base font-bold text-texte">{step.titre}</h3>
                <p className="mt-1 text-sm text-texte-muted">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
