import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSmsProvider } from "@/lib/sms";

/** OTP SMS parent (§2.2, §2.7, §7) — code à usage unique, expiration courte. */
export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

export function genererCodeOtp(): string {
  return Array.from({ length: OTP_LENGTH }, () => randomInt(0, 10)).join("");
}

export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyOtp(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

/**
 * Génère, stocke et envoie un OTP pour un numéro donné — utilisé par la
 * connexion parent (`/api/auth/parent/request-otp`, §2.2). L'envoi passe par
 * `SmsProvider` (`src/lib/sms`) : en `SMS_MODE=mock` le code est logué dans le
 * conteneur, en `smspro` il part par SMS réel via SmsPro — sans rien changer
 * ici. L'appelant reste responsable de son propre rate limiting, adapté à son
 * contexte.
 */
export async function envoyerOtp(telephone: string): Promise<{ codeDevMock?: string }> {
  const code = genererCodeOtp();
  const codeOtpHash = await hashOtp(code);
  const expiration = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await prisma.otpVerification.create({ data: { telephone, codeOtpHash, expiration } });

  await getSmsProvider().envoyerOtp(telephone, code, OTP_TTL_MINUTES);

  // ⚠️ TEMPORAIRE (réintroduit le 17 septembre 2026, cf. docs/PROGRESS.md §73) — retiré une
  // première fois le même jour, remis uniquement parce que le Sender ID SmsPro "Klarity" est
  // encore en attente de validation opérateurs et qu'aucun vrai SMS ne peut donc être livré
  // pour l'instant (§72). Condition volontairement double, pas juste NODE_ENV : ne s'active
  // QUE si SMS_MODE=mock (aucun SMS réel n'a été tenté, rien à protéger) — si SMS_MODE=smspro
  // est actif, même en dev, ce code reste caché, pour ne jamais afficher un code à côté d'une
  // vraie tentative d'envoi. À RETIRER dès que le Sender ID est validé et qu'on repasse en
  // SMS_MODE=smspro pour de bon (cf. §5 point 5 de PROGRESS.md).
  const modeMock = (process.env.SMS_MODE ?? "mock") === "mock";
  return { codeDevMock: process.env.NODE_ENV !== "production" && modeMock ? code : undefined };
}
