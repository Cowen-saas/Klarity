import { verify } from "otplib";

/** 2FA obligatoire pour l'admin (§2.7, §4.1, §7) — TOTP contre Admin.twoFactorSecret. */
export async function verifyTotp(code: string, secret: string): Promise<boolean> {
  const result = await verify({ secret, token: code });
  return result.valid;
}
