import { IconSparkles } from "@/components/icons";

/**
 * Widget de démonstration du Tuteur IA sur la landing page -- statique, non
 * interactif. Reprend à l'identique la pastille verte + glyphe étoile utilisée
 * dans la nav élève et sur l'écran de chat réel (cf. CDC §2.1.1 : cette icône ne
 * doit jamais être remplacée par un simple libellé texte sur cette surface).
 */
export function TuteurDemoWidget() {
  return (
    <div className="rounded-2xl border border-border bg-fond p-4 shadow-sm">
      <div className="rounded-xl bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
            <IconSparkles className="h-4 w-4" weight="fill" aria-hidden="true" />
          </span>
          <p className="text-sm font-bold text-texte">Tuteur IA</p>
        </div>

        <div className="space-y-3">
          <p className="rounded-xl bg-fond px-4 py-3 text-sm text-texte">
            Je ne comprends pas les dérivées.
          </p>
          <p className="rounded-xl bg-primary-light px-4 py-3 text-sm leading-relaxed text-texte">
            Pas de problème. Commençons par comprendre ce qu&apos;est une dérivée, avec un exemple
            concret...
          </p>
        </div>
      </div>
    </div>
  );
}
