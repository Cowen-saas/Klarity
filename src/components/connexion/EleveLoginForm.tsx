"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PinInput } from "@/components/ui/PinInput";
import { cibleRetour } from "@/lib/api-client";
import { IconGraduationCap } from "@/components/icons";

export function EleveLoginForm({ from }: { from: string | null }) {
  const router = useRouter();
  const [codeEleve, setCodeEleve] = useState("");
  const [pin, setPin] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!codeEleve.trim() || pin.length !== 4) {
      setErreur("Entre ton code élève et ton code secret à 4 chiffres.");
      return;
    }
    setErreur(null);
    setEnCours(true);
    try {
      const resultat = await signIn("eleve", {
        codeEleve: codeEleve.trim().toUpperCase(),
        pin,
        redirect: false,
      });
      if (!resultat || resultat.error) {
        setErreur("Code élève ou code secret incorrect.");
        setPin("");
        return;
      }
      router.push(cibleRetour(from, "ELEVE"));
      router.refresh();
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-primary">
        <IconGraduationCap className="h-8 w-8" weight="fill" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-3xl font-extrabold text-texte">Connexion élève</h1>
      <p className="mt-2 text-base text-texte-muted">Retrouve ton tuteur IA, tes épreuves et tes quiz.</p>

      <div className="mt-6">
        <label htmlFor="codeEleve" className="mb-2 block text-sm font-semibold text-texte">
          Code élève
        </label>
        <input
          id="codeEleve"
          type="text"
          autoFocus
          autoComplete="username"
          value={codeEleve}
          onChange={(e) => setCodeEleve(e.target.value)}
          placeholder="ELE-482-719"
          className="w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-base text-texte outline-none transition-colors focus:border-primary"
        />
      </div>

      <div className="mt-5">
        <PinInput id="eleve-pin" label="Code secret (4 chiffres)" value={pin} onChange={setPin} />
      </div>

      <p className="mt-2 text-sm font-semibold text-primary">PIN oublié ?</p>

      {erreur && <p className="mt-3 text-sm text-danger">{erreur}</p>}

      <button
        type="submit"
        disabled={enCours}
        className="mt-6 w-full rounded-xl bg-primary py-3 text-center text-base font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {enCours ? "Connexion…" : "Se connecter"}
      </button>

      <div className="mt-4 rounded-xl bg-fond p-4">
        <p className="text-xs text-texte-muted">
          Code secret oublié ? Seul ton parent peut le réinitialiser depuis son tableau de bord. Il n&apos;y a pas de
          récupération autonome côté élève.
        </p>
      </div>
    </form>
  );
}
