import { IconGraduationCap } from "@/components/icons";

/** Marque Klarity — badge chapeau de diplôme + wordmark, réutilisée dans les 3 sidebars. */
export function KlarityLogo({ wordmark }: { wordmark: string }) {
  return (
    <div className="mb-8 flex items-center gap-2 px-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
        <IconGraduationCap className="h-5 w-5" weight="fill" aria-hidden="true" />
      </span>
      <span className="text-lg font-bold text-white">{wordmark}</span>
    </div>
  );
}
