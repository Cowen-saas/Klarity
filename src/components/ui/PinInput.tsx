"use client";

import { useRef } from "react";

interface PinInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  /** false pour un code visible en clair (ex. OTP affiché à l'écran, §2.2) — masqué par défaut. */
  masque?: boolean;
}

/** Saisie de code à N chiffres, une case par chiffre — PIN élève ou OTP parent (§2.1, §2.2). */
export function PinInput({ id, label, value, onChange, length = 4, autoFocus = false, masque = true }: PinInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function setDigitAt(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join(""));
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setDigitAt(index, digit);
    if (digit && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
      setDigitAt(index - 1, "");
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted.padEnd(length, "").slice(0, length));
    inputsRef.current[Math.min(pasted.length, length - 1)]?.focus();
  }

  return (
    <fieldset className="border-0 p-0 m-0">
      <legend id={`${id}-legend`} className="mb-2 text-sm font-semibold text-texte">
        {label}
      </legend>
      <div className="flex gap-3" role="group" aria-labelledby={`${id}-legend`}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputsRef.current[index] = el;
            }}
            id={`${id}-${index}`}
            type={masque ? "password" : "text"}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoFocus={autoFocus && index === 0}
            aria-label={`Chiffre ${index + 1} sur ${length}`}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className="h-14 w-14 rounded-xl border-2 border-border bg-surface text-center text-xl font-semibold text-texte outline-none transition-colors focus:border-primary"
          />
        ))}
      </div>
    </fieldset>
  );
}
