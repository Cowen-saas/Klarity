"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { cibleRetour } from "@/lib/api-client";
import { IconShieldCheck } from "@/components/icons";

export function AdminLoginForm({ from }: { from: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || totpCode.length !== 6) {
      setErreur("Renseigne ton email, ton mot de passe et le code à 6 chiffres de ton application 2FA.");
      return;
    }
    setErreur(null);
    setEnCours(true);
    try {
      const resultat = await signIn("admin", {
        email: email.trim(),
        password,
        totpCode,
        redirect: false,
      });
      if (!resultat || resultat.error) {
        setErreur("Identifiants ou code d'authentification incorrects.");
        setTotpCode("");
        return;
      }
      router.push(cibleRetour(from, "ADMIN"));
      router.refresh();
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
        <IconShieldCheck className="h-7 w-7" weight="fill" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-xl font-bold text-texte">Connexion admin</h1>
      <p className="mt-1 text-sm text-texte-muted">Accès réservé à l&apos;équipe Klarity.</p>

      <div className="mt-6">
        <label htmlFor="adminEmail" className="mb-2 block text-sm font-semibold text-texte">
          Email
        </label>
        <input
          id="adminEmail"
          type="email"
          autoFocus
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@klarity.cm"
          className="w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-base text-texte outline-none transition-colors focus:border-primary"
        />
      </div>

      <div className="mt-5">
        <label htmlFor="adminPassword" className="mb-2 block text-sm font-semibold text-texte">
          Mot de passe
        </label>
        <input
          id="adminPassword"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-base text-texte outline-none transition-colors focus:border-primary"
        />
      </div>

      <div className="mt-5">
        <label htmlFor="adminTotp" className="mb-2 block text-sm font-semibold text-texte">
          Code d&apos;authentification (2FA)
        </label>
        <input
          id="adminTotp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          className="w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-center text-base tracking-[0.3em] text-texte outline-none transition-colors focus:border-primary"
        />
      </div>

      {erreur && <p className="mt-3 text-sm text-danger">{erreur}</p>}

      <button
        type="submit"
        disabled={enCours}
        className="mt-6 w-full rounded-xl bg-primary py-3 text-center text-base font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {enCours ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
