import type { Metadata } from "next";
import { InscriptionWizard } from "@/components/inscription/InscriptionWizard";

export const metadata: Metadata = {
  title: "Inscription élève — Klarity",
};

export default function InscriptionPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-fond px-4 py-10">
      <InscriptionWizard />
    </main>
  );
}
