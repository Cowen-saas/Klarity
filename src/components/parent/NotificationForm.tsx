"use client";

import { useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  IconChatText,
  IconWhatsapp,
  IconCalendarCheck,
  IconCalendarBlank,
  IconWarning,
  IconCheckCircle,
} from "@/components/icons";

type Canal = "SMS" | "WHATSAPP";
type Frequence = "HEBDOMADAIRE" | "MENSUEL" | "CRITIQUE_UNIQUEMENT";

const CANAUX: Array<{ value: Canal; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  { value: "SMS", label: "SMS", icon: IconChatText },
  { value: "WHATSAPP", label: "WhatsApp", icon: IconWhatsapp },
];

const FREQUENCES: Array<{
  value: Frequence;
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}> = [
  {
    value: "HEBDOMADAIRE",
    label: "Résumé hebdomadaire",
    description: "Un message chaque semaine avec les points clés.",
    icon: IconCalendarCheck,
  },
  {
    value: "MENSUEL",
    label: "Résumé mensuel",
    description: "Un bilan complet une fois par mois.",
    icon: IconCalendarBlank,
  },
  {
    value: "CRITIQUE_UNIQUEMENT",
    label: "Alertes critiques uniquement",
    description: "Seulement en cas de lacune importante.",
    icon: IconWarning,
  },
];

const CANAL_APERCU: Record<Canal, string> = {
  SMS: "un SMS",
  WHATSAPP: "un message WhatsApp",
};

const FREQUENCE_APERCU: Record<Frequence, string> = {
  HEBDOMADAIRE: "chaque semaine, avec les points clés de la progression de tes enfants",
  MENSUEL: "chaque mois, avec un bilan complet",
  CRITIQUE_UNIQUEMENT: "uniquement quand une lacune importante est détectée",
};

interface NotificationFormProps {
  canalInitial: Canal;
  frequenceInitiale: Frequence;
}

export function NotificationForm({ canalInitial, frequenceInitiale }: NotificationFormProps) {
  const [canal, setCanal] = useState<Canal>(canalInitial);
  const [frequence, setFrequence] = useState<Frequence>(frequenceInitiale);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function enregistrer() {
    setEnregistrement(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/parent/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canal, frequence }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error ?? "Impossible d'enregistrer les préférences.");
        return;
      }
      setMessage("Préférences enregistrées.");
    } catch {
      setMessage("Impossible de contacter le serveur.");
    } finally {
      setEnregistrement(false);
    }
  }

  const CanalIconApercu = CANAUX.find((c) => c.value === canal)!.icon;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="rounded-2xl bg-surface p-6 shadow-sm sm:p-8">
        <fieldset className="border-0 p-0">
          <legend className="mb-3 text-xs font-semibold tracking-wide text-primary uppercase">Canal</legend>
          <div className="grid grid-cols-2 gap-3">
            {CANAUX.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={canal === c.value}
                  onClick={() => setCanal(c.value)}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-bold transition-colors ${
                    canal === c.value ? "border-primary bg-primary-light text-primary" : "border-border bg-surface text-texte hover:border-primary/40"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {c.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-8 border-0 p-0">
          <legend className="mb-3 text-xs font-semibold tracking-wide text-primary uppercase">Fréquence</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {FREQUENCES.map((f) => {
              const Icon = f.icon;
              const actif = frequence === f.value;
              return (
                <label
                  key={f.value}
                  className={`flex cursor-pointer flex-col gap-2 rounded-xl border-2 p-4 transition-colors ${
                    actif ? "border-primary bg-primary-light" : "border-border bg-surface hover:border-primary/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="frequence"
                    value={f.value}
                    checked={actif}
                    onChange={() => setFrequence(f.value)}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between">
                    <Icon className={`h-6 w-6 ${actif ? "text-primary" : "text-texte-muted"}`} aria-hidden="true" />
                    {actif && <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
                  </div>
                  <p className={`text-sm font-bold ${actif ? "text-primary" : "text-texte"}`}>{f.label}</p>
                  <p className="text-xs text-texte-muted">{f.description}</p>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={enregistrer}
            disabled={enregistrement}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {enregistrement ? "Enregistrement…" : "Enregistrer les préférences"}
          </button>
          {message && (
            <p role="status" className="flex items-center gap-1.5 text-sm text-texte-muted">
              {message === "Préférences enregistrées." && <IconCheckCircle className="h-4 w-4 text-success" aria-hidden="true" weight="fill" />}
              {message}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-primary-light p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">Aperçu</p>
        <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
          <CanalIconApercu className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-4 text-base text-texte">
          Tu recevras <strong>{CANAL_APERCU[canal]}</strong> {FREQUENCE_APERCU[frequence]}.
        </p>
      </div>
    </div>
  );
}
