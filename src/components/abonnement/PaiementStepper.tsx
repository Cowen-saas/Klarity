import { IconCheckCircle } from "@/components/icons";

const ETAPES = [
  { n: 1, label: "Formule" },
  { n: 2, label: "Paiement" },
  { n: 3, label: "Vérification" },
  { n: 4, label: "Confirmation" },
] as const;

/** Stepper horizontal du parcours de paiement (§17, écrans 15-17). */
export function PaiementStepper({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="mx-auto mb-10 flex max-w-xl items-start justify-between">
      {ETAPES.map((etape, i) => {
        const complete = etape.n < step;
        const active = etape.n === step;
        return (
          <li key={etape.n} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  complete
                    ? "bg-primary text-white"
                    : active
                      ? "border-2 border-primary text-primary"
                      : "border-2 border-border text-texte-muted"
                }`}
              >
                {complete ? <IconCheckCircle className="h-4 w-4" weight="fill" aria-hidden="true" /> : etape.n}
              </span>
              <span className={`text-xs font-semibold ${active || complete ? "text-texte" : "text-texte-muted"}`}>
                {etape.label}
              </span>
            </div>
            {i < ETAPES.length - 1 && (
              <div className={`mx-2 mt-[-18px] h-px flex-1 ${complete ? "bg-primary" : "bg-border"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
