"use client";

import { useSearchParams } from "next/navigation";
import { AdminLoginForm } from "./AdminLoginForm";

/** Écran de connexion admin autonome (/admin/connexion) — jamais lié depuis /connexion. */
export function AdminConnexionForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const sessionExpiree = searchParams.get("raison") === "expiree";

  return (
    <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-sm sm:p-8">
      {sessionExpiree && (
        <div className="mb-5 rounded-xl border border-accent/30 bg-accent-light px-4 py-3 text-sm text-texte">
          <p className="font-semibold">Ta session a expiré.</p>
          <p className="mt-1 text-texte-muted">Reconnecte-toi pour reprendre là où tu en étais.</p>
        </div>
      )}
      <AdminLoginForm from={from} />
    </div>
  );
}
