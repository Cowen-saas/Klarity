"use client";

import { useSearchParams } from "next/navigation";
import { AdminLoginForm } from "./AdminLoginForm";

/** Écran de connexion admin autonome (/admin/connexion) — jamais lié depuis /connexion. */
export function AdminConnexionForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  return (
    <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-sm sm:p-8">
      <AdminLoginForm from={from} />
    </div>
  );
}
