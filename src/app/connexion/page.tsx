import { Suspense } from "react";
import type { Metadata } from "next";
import { ConnexionForm } from "@/components/connexion/ConnexionForm";

export const metadata: Metadata = {
  title: "Connexion — Klarity",
};

export default function ConnexionPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-fond px-4 py-10">
      <Suspense>
        <ConnexionForm />
      </Suspense>
    </main>
  );
}
