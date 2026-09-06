"use client";

import { useId } from "react";
import {
  TELEPHONE_PREFIXE_AFFICHE,
  TELEPHONE_CHIFFRES_LOCAUX,
  chiffresLocauxTelephone,
  formaterChiffresLocaux,
  versTelephoneCanonique,
} from "@/lib/format";

interface PhoneInputProps {
  /** Valeur canonique `+2376XXXXXXXX` (ou `+2376` / vide au départ). */
  value: string;
  /** Reçoit la valeur canonique à chaque frappe. */
  onChange: (canonique: string) => void;
  id?: string;
  label?: string;
  autoFocus?: boolean;
  /** id d'un message d'erreur à rattacher (`aria-describedby`). */
  erreurId?: string;
  disabled?: boolean;
}

// "XX XX XX XX" = 8 chiffres + 3 espaces.
const LONGUEUR_AFFICHEE_MAX = TELEPHONE_CHIFFRES_LOCAUX + 3;

/**
 * Saisie d'un numéro de mobile camerounais imposant le format
 * `+237 6XX XX XX XX`. Le préfixe `+237 6` est un élément fixe **hors du champ**
 * — impossible à effacer. L'utilisateur ne tape que les 8 chiffres suivants,
 * groupés `XX XX XX XX` au fil de la frappe. La valeur remontée est toujours la
 * forme canonique `+2376XXXXXXXX`.
 */
export function PhoneInput({ value, onChange, id, label, autoFocus, erreurId, disabled }: PhoneInputProps) {
  const generatedId = useId();
  const champId = id ?? generatedId;
  const formatId = `${champId}-format`;

  const chiffres = chiffresLocauxTelephone(value);
  const affichage = formaterChiffresLocaux(chiffres);

  function handleChange(saisie: string) {
    const nouveauxChiffres = chiffresLocauxTelephone(saisie);
    onChange(versTelephoneCanonique(nouveauxChiffres));
  }

  return (
    <div>
      {label && (
        <label htmlFor={champId} className="mb-2 block text-sm font-semibold text-texte">
          {label}
        </label>
      )}
      <div
        className={`flex items-baseline rounded-xl border-2 bg-surface px-4 py-3 transition-colors focus-within:border-primary ${
          erreurId ? "border-danger" : "border-border"
        } ${disabled ? "opacity-60" : ""}`}
      >
        {/* Préfixe fixe, hors du champ : impossible à effacer. Collé au premier
            chiffre pour donner le groupe « 6XX » du format +237 6XX XX XX XX. */}
        <span aria-hidden="true" className="shrink-0 text-base font-semibold whitespace-pre text-texte-muted select-none">
          {TELEPHONE_PREFIXE_AFFICHE}
        </span>
        <input
          id={champId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          disabled={disabled}
          value={affichage}
          onChange={(e) => handleChange(e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            handleChange(e.clipboardData.getData("text"));
          }}
          maxLength={LONGUEUR_AFFICHEE_MAX}
          placeholder="XX XX XX XX"
          aria-label={label ?? "Numéro de téléphone"}
          aria-describedby={[formatId, erreurId].filter(Boolean).join(" ") || undefined}
          className="w-full min-w-0 bg-transparent text-base font-semibold tracking-wide text-texte outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-texte-muted/60"
        />
      </div>
      <p id={formatId} className="mt-1.5 text-xs text-texte-muted">
        Format&nbsp;: {TELEPHONE_PREFIXE_AFFICHE}XX&nbsp;XX&nbsp;XX&nbsp;XX
      </p>
    </div>
  );
}
