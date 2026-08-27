"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { StepProgress } from "./StepProgress";
import { InscriptionSidePanel } from "./InscriptionSidePanel";
import { PinInput } from "@/components/ui/PinInput";
import { IconLock, IconCheckCircle } from "@/components/icons";

type Classe = "TROISIEME" | "PREMIERE" | "TERMINALE";
type Filiere = "A" | "C" | "D" | "TI";

const CLASSES: Array<{ value: Classe; label: string }> = [
  { value: "TROISIEME", label: "3e" },
  { value: "PREMIERE", label: "1ère" },
  { value: "TERMINALE", label: "Terminale" },
];

const FILIERES: Filiere[] = ["A", "C", "D", "TI"];

const TOTAL_STEPS = 4;

export function InscriptionWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [nom, setNom] = useState("");
  const [classe, setClasse] = useState<Classe | null>(null);
  const [filiere, setFiliere] = useState<Filiere | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [codeEleve, setCodeEleve] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function goToStep2() {
    if (nom.trim().length < 2) {
      setError("Entre ton nom (au moins 2 caractères).");
      return;
    }
    setError(null);
    setStep(2);
  }

  function goToStep3() {
    if (!classe) {
      setError("Choisis ta classe.");
      return;
    }
    if (classe !== "TROISIEME" && !filiere) {
      setError("Choisis ta filière.");
      return;
    }
    setError(null);
    setStep(3);
  }

  function handleClasseChange(value: Classe) {
    setClasse(value);
    if (value === "TROISIEME") setFiliere(null);
  }

  async function handleSubmit() {
    if (!/^\d{4}$/.test(pin)) {
      setError("Le code secret doit contenir 4 chiffres.");
      return;
    }
    if (pin !== pinConfirm) {
      setError("Les deux codes ne correspondent pas.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/eleve/inscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: nom.trim(),
          classe,
          filiere: classe === "TROISIEME" ? undefined : filiere,
          pin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue, réessaie.");
        return;
      }
      setCodeEleve(data.codeEleve);
      setStep(4);
      // Session ouverte en silence dès la création du compte, pour que
      // "Accéder à mon tableau de bord" soit instantané (pas de second login).
      await signIn("eleve", { codeEleve: data.codeEleve, pin, redirect: false });
    } catch {
      setError("Impossible de contacter le serveur, vérifie ta connexion.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyCode() {
    if (!codeEleve) return;
    await navigator.clipboard.writeText(codeEleve);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleAccederDashboard() {
    router.push("/eleve");
    router.refresh();
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  return (
    <div className="flex w-full max-w-4xl overflow-hidden rounded-3xl bg-surface shadow-xl md:min-h-[600px]">
      <InscriptionSidePanel step={step} total={TOTAL_STEPS} />

      <div className="flex-1 p-6 sm:p-10 md:p-12">
      {step < 3 && (
        <div className="mb-6">
          <StepProgress step={step} total={TOTAL_STEPS} />
        </div>
      )}

      {step > 1 && step < TOTAL_STEPS && (
        <button
          type="button"
          onClick={goBack}
          className="mb-4 text-sm font-medium text-texte-muted hover:text-texte"
        >
          ← Retour
        </button>
      )}

      {step === 1 && (
        <div>
          <h1 className="text-xl font-bold text-texte">Comment tu t&apos;appelles ?</h1>
          <p className="mt-1 text-sm text-texte-muted">On l&apos;utilisera pour personnaliser ton expérience.</p>

          <div className="mt-6">
            <label htmlFor="nom" className="mb-2 block text-sm font-semibold text-texte">
              Ton nom
            </label>
            <input
              id="nom"
              type="text"
              autoFocus
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && goToStep2()}
              placeholder="Ex. Aïcha Ngono"
              className="w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-base text-texte outline-none transition-colors focus:border-primary"
            />
          </div>

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          <button
            type="button"
            onClick={goToStep2}
            className="mt-6 w-full rounded-xl bg-primary py-3 text-center text-base font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Continuer
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h1 className="text-xl font-bold text-texte">Quelle est ta classe ?</h1>
          <p className="mt-1 text-sm text-texte-muted">Ça nous aide à te proposer le bon contenu.</p>

          <fieldset className="mt-6 grid grid-cols-3 gap-3 border-0 p-0">
            <legend className="sr-only">Classe</legend>
            {CLASSES.map((c) => (
              <label
                key={c.value}
                className={`flex cursor-pointer items-center justify-center rounded-xl border-2 px-3 py-3 text-center text-base font-medium transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-light has-[:checked]:text-primary ${
                  classe === c.value ? "" : "border-border bg-surface text-texte hover:border-primary/40"
                }`}
              >
                <input
                  type="radio"
                  name="classe"
                  value={c.value}
                  checked={classe === c.value}
                  onChange={() => handleClasseChange(c.value)}
                  className="sr-only"
                />
                {c.label}
              </label>
            ))}
          </fieldset>

          {classe && classe !== "TROISIEME" && (
            <fieldset className="mt-6 border-0 p-0">
              <legend className="mb-2 text-sm font-semibold text-texte">Filière</legend>
              <div className="grid grid-cols-4 gap-3">
                {FILIERES.map((f) => (
                  <label
                    key={f}
                    className={`cursor-pointer rounded-xl border-2 py-3 text-center text-base font-semibold transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-white ${
                      filiere === f ? "" : "border-border bg-surface text-texte hover:border-primary/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="filiere"
                      value={f}
                      checked={filiere === f}
                      onChange={() => setFiliere(f)}
                      className="sr-only"
                    />
                    {f}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          <button
            type="button"
            onClick={goToStep3}
            className="mt-6 w-full rounded-xl bg-primary py-3 text-center text-base font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Continuer
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
            <IconLock className="h-7 w-7" weight="fill" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-texte">Choisis ton code secret</h1>
          <p className="mt-1 text-sm text-texte-muted">
            Un code à 4 chiffres pour te connecter rapidement la prochaine fois.
          </p>

          <div className="mt-6 flex flex-col items-center gap-6">
            <PinInput id="pin" label="Code secret" value={pin} onChange={setPin} autoFocus />
            <PinInput id="pin-confirm" label="Confirme ton code" value={pinConfirm} onChange={setPinConfirm} />
          </div>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-6 w-full rounded-xl bg-primary py-3 text-center text-base font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {submitting ? "Création du compte..." : "Valider mon code secret"}
          </button>
        </div>
      )}

      {step === 4 && codeEleve && (
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-light text-success">
            <IconCheckCircle className="h-7 w-7" weight="fill" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-texte">Compte créé !</h1>
          <p className="mt-1 text-sm text-texte-muted">Voici ton code élève</p>

          <div className="mt-6 rounded-xl border-2 border-dashed border-border bg-fond px-4 py-6">
            <p className="text-xs font-semibold tracking-wide text-texte-muted uppercase">Ton code élève</p>
            <p className="mt-2 font-serif text-2xl font-bold text-primary">{codeEleve}</p>
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            className="mt-4 w-full rounded-xl border-2 border-border bg-surface py-3 text-center text-base font-semibold text-texte transition-colors hover:border-primary/40"
          >
            {copied ? "Copié !" : "Copier le code"}
          </button>

          <p className="mt-4 text-sm text-texte-muted">
            Conserve ce code. Il permettra à ton parent d&apos;accéder à ton suivi.
          </p>

          <button
            type="button"
            onClick={handleAccederDashboard}
            className="mt-6 w-full rounded-xl bg-primary py-3 text-center text-base font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Accéder à mon tableau de bord →
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
