import Link from "next/link";
import { TuteurDemoWidget } from "./TuteurDemoWidget";

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:px-8 sm:py-20">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <span className="inline-block rounded-full bg-primary-light px-4 py-1.5 text-xs font-bold text-primary">
            Nouveau · Correction IA en 30 secondes
          </span>

          <h1 className="mt-5 text-4xl font-bold text-texte sm:text-5xl">
            Le compagnon scolaire qui comprend tes lacunes
          </h1>

          <p className="mt-5 max-w-lg text-base text-texte-muted sm:text-lg">
            Explications de cours, correction d&apos;épreuves par photo, quiz personnalisés. Pensé
            pour les élèves de 3e, 1ère et Terminale — même avec peu de données.
          </p>

          <Link
            href="/inscription"
            className="mt-8 inline-block rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Commencer gratuitement
          </Link>
        </div>

        <TuteurDemoWidget />
      </div>
    </section>
  );
}
