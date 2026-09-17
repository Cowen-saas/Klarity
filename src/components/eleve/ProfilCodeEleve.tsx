"use client";

import { useState } from "react";

/** Bouton copier le code élève (profil, §4.1) — même patron que InscriptionWizard.tsx. */
export function ProfilCodeEleve({ code }: { code: string }) {
  const [copie, setCopie] = useState(false);

  async function copier() {
    await navigator.clipboard.writeText(code);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  return (
    <div>
      <div className="rounded-xl border-2 border-dashed border-border bg-fond px-4 py-5 text-center">
        <p className="text-xs font-semibold tracking-wide text-texte-muted uppercase">Ton code élève</p>
        <p className="mt-2 font-serif text-2xl font-bold text-primary">{code}</p>
      </div>
      <button
        type="button"
        onClick={copier}
        className="mt-3 w-full rounded-xl border-2 border-border bg-surface py-2.5 text-center text-sm font-semibold text-texte transition-colors hover:border-primary/40"
      >
        {copie ? "Copié !" : "Copier le code"}
      </button>
    </div>
  );
}
