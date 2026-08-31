"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PinInput } from "@/components/ui/PinInput";
import { IconUser, IconLock } from "@/components/icons";
import { masquerTelephone } from "@/lib/format";

const DELAI_RENVOI_SECONDES = 60;

interface ParentLoginFormProps {
  from: string | null;
  onEtapeChange?: (etape: "demande" | "verification") => void;
}

export function ParentLoginForm({ from, onEtapeChange }: ParentLoginFormProps) {
  const router = useRouter();
  const [etape, setEtapeInterne] = useState<"demande" | "verification">("demande");
  const [telephone, setTelephone] = useState("");
  const [codeEleve, setCodeEleve] = useState("");
  const [otp, setOtp] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [secondesRestantes, setSecondesRestantes] = useState(0);
  const [codeDevMock, setCodeDevMock] = useState<string | null>(null);

  function setEtape(next: "demande" | "verification") {
    setEtapeInterne(next);
    onEtapeChange?.(next);
  }

  useEffect(() => {
    if (secondesRestantes <= 0) return;
    const t = setTimeout(() => setSecondesRestantes((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondesRestantes]);

  async function demanderCode(e: React.FormEvent) {
    e.preventDefault();
    if (!telephone.trim() || !codeEleve.trim()) {
      setErreur("Renseigne ton numéro de téléphone et le code élève.");
      return;
    }
    setErreur(null);
    setEnCours(true);
    try {
      const res = await fetch("/api/auth/parent/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telephone: telephone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.error ?? "Impossible d'envoyer le code.");
        return;
      }
      setOtp("");
      setCodeDevMock(typeof data.codeDevMock === "string" ? data.codeDevMock : null);
      setEtape("verification");
      setSecondesRestantes(DELAI_RENVOI_SECONDES);
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setEnCours(false);
    }
  }

  async function verifierCode(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      setErreur("Entre le code à 6 chiffres reçu par SMS.");
      return;
    }
    setErreur(null);
    setEnCours(true);
    try {
      const resultat = await signIn("parent", {
        codeEleve: codeEleve.trim().toUpperCase(),
        telephone: telephone.trim(),
        otp,
        redirect: false,
      });
      if (!resultat || resultat.error) {
        setErreur("Code de vérification incorrect ou expiré.");
        setOtp("");
        return;
      }
      router.push(from && (from.startsWith("/parent") || from.startsWith("/abonnement")) ? from : "/parent");
      router.refresh();
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setEnCours(false);
    }
  }

  if (etape === "verification") {
    return (
      <form onSubmit={verifierCode} className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light text-accent">
          <IconLock className="h-8 w-8" weight="fill" aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-3xl font-extrabold text-texte">Vérification</h1>
        <p className="mt-2 text-base text-texte-muted">Code envoyé au {masquerTelephone(telephone)}</p>

        <div className="mt-6 flex justify-center">
          <PinInput id="otp" label="Code de vérification" value={otp} onChange={setOtp} length={6} masque={false} autoFocus />
        </div>

        {codeDevMock && (
          <button
            type="button"
            onClick={() => setOtp(codeDevMock)}
            className="mx-auto mt-3 block rounded-lg bg-accent-light px-3 py-1.5 text-xs font-semibold text-texte"
          >
            Dev uniquement — code : {codeDevMock} (cliquer pour remplir)
          </button>
        )}

        <p className="mt-3 text-sm text-texte-muted">
          {secondesRestantes > 0 ? (
            <>
              Renvoyer le code dans <strong>00:{secondesRestantes.toString().padStart(2, "0")}</strong>
            </>
          ) : (
            <button type="button" onClick={demanderCode} className="font-semibold text-primary">
              Renvoyer le code
            </button>
          )}
        </p>

        {erreur && <p className="mt-3 text-sm text-danger">{erreur}</p>}

        <button
          type="submit"
          disabled={enCours}
          className="mt-6 w-full rounded-xl bg-primary py-3 text-center text-base font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {enCours ? "Vérification…" : "Vérifier"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEtape("demande");
            setErreur(null);
          }}
          className="mt-3 text-sm font-semibold text-primary"
        >
          Modifier le numéro
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={demanderCode}>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-primary">
        <IconUser className="h-8 w-8" weight="fill" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-3xl font-extrabold text-texte">Espace parent</h1>
      <p className="mt-2 text-base text-texte-muted">Suis la progression de ton enfant en temps réel.</p>

      <div className="mt-6">
        <label htmlFor="telephone" className="mb-2 block text-sm font-semibold text-texte">
          Numéro de téléphone
        </label>
        <input
          id="telephone"
          type="tel"
          autoFocus
          autoComplete="tel"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          placeholder="+237 6XX XX XX XX"
          className="w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-base text-texte outline-none transition-colors focus:border-primary"
        />
      </div>

      <div className="mt-5">
        <label htmlFor="codeEleveParent" className="mb-2 block text-sm font-semibold text-texte">
          Code élève
        </label>
        <input
          id="codeEleveParent"
          type="text"
          autoComplete="off"
          value={codeEleve}
          onChange={(e) => setCodeEleve(e.target.value)}
          placeholder="ELE-482-719"
          className="w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-base text-texte outline-none transition-colors focus:border-primary"
        />
      </div>

      {erreur && <p className="mt-3 text-sm text-danger">{erreur}</p>}

      <button
        type="submit"
        disabled={enCours}
        className="mt-6 w-full rounded-xl bg-primary py-3 text-center text-base font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {enCours ? "Envoi…" : "Recevoir le code"}
      </button>
    </form>
  );
}
