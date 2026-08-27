import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { AdminConnexionForm } from "@/components/connexion/AdminConnexionForm";

/**
 * Connexion admin (§4.1 CDC) — jamais liée depuis /connexion ni aucune autre
 * page publique, accessible uniquement en connaissant l'URL exacte. Les
 * comptes admin eux-mêmes ne se créent jamais ici ni via aucune route HTTP :
 * uniquement via `prisma/create-admin.ts` (script CLI, cf. docs/PROGRESS.md).
 */
export const metadata: Metadata = {
  title: "Connexion admin — Klarity",
  robots: { index: false, follow: false },
};

export default async function AdminConnexionPage() {
  const session = await auth();
  if (session && !session.error && session.user.role === "ADMIN") {
    redirect("/admin");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Suspense>
        <AdminConnexionForm />
      </Suspense>
    </main>
  );
}
