interface StepProgressProps {
  step: number;
  total: number;
}

/** Barre de progression à segments + repère "Étape N sur total" (§2.1, feedback multi-étapes). */
export function StepProgress({ step, total }: StepProgressProps) {
  return (
    <div>
      <div className="flex gap-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold tracking-wide text-primary uppercase">
        Étape {step} sur {total}
      </p>
    </div>
  );
}
