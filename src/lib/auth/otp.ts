import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

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
