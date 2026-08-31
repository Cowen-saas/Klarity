import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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
 * Génère, stocke et "envoie" (log en dev, fournisseur SMS réel à brancher —
 * §3) un OTP pour un numéro donné — utilisé par la connexion parent
 * (`/api/auth/parent/request-otp`, §2.2). L'appelant reste responsable de son
 * propre rate limiting, adapté à son contexte.
 */
export async function envoyerOtp(telephone: string): Promise<{ codeDevMock?: string }> {
  const code = genererCodeOtp();
  const codeOtpHash = await hashOtp(code);
  const expiration = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await prisma.otpVerification.create({ data: { telephone, codeOtpHash, expiration } });

  if (process.env.NODE_ENV !== "production") {
    console.log(`[OTP mock] ${telephone} -> ${code} (expire dans ${OTP_TTL_MINUTES} min)`);
  }

  // Hors production uniquement : évite d'avoir à relayer le code par les logs
  // Docker pendant les tests manuels. Jamais renvoyé en production — le SMS
  // réel (§3) reste le seul canal une fois le fournisseur branché.
  return { codeDevMock: process.env.NODE_ENV !== "production" ? code : undefined };
}
