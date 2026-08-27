import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { genererCodeOtp, hashOtp, OTP_TTL_MINUTES } from "@/lib/auth/otp";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Envoi de l'OTP SMS pour la connexion parent (§2.2, §2.7). Rate limiting IP +
 * téléphone, les deux (réf. sécurité §2, cahier des charges §7). Le
 * fournisseur SMS reste à sélectionner (§3) — envoi simulé (log) en dev/mock
 * en attendant.
 */
const bodySchema = z.object({
  telephone: z.string().min(8),
});

const LIMIT = 5;
const WINDOW_SECONDS = 15 * 60;

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Numéro de téléphone invalide." }, { status: 400 });
  }
  const { telephone } = parsed.data;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const [okTelephone, okIp] = await Promise.all([
    checkRateLimit(`otp:tel:${telephone}`, LIMIT, WINDOW_SECONDS),
    checkRateLimit(`otp:ip:${ip}`, LIMIT, WINDOW_SECONDS),
  ]);
  if (!okTelephone || !okIp) {
    return NextResponse.json({ error: "Trop de tentatives, réessayez plus tard." }, { status: 429 });
  }

  const code = genererCodeOtp();
  const codeOtpHash = await hashOtp(code);
  const expiration = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await prisma.otpVerification.create({ data: { telephone, codeOtpHash, expiration } });

  if (process.env.NODE_ENV !== "production") {
    console.log(`[OTP mock] ${telephone} -> ${code} (expire dans ${OTP_TTL_MINUTES} min)`);
  }
  // TODO Phase 2+ : brancher le vrai fournisseur SMS (§3) une fois sélectionné.

  // Hors production uniquement : évite d'avoir à relayer le code par les logs
  // Docker pendant les tests manuels. Jamais renvoyé en production — le SMS
  // réel (§3) reste le seul canal une fois le fournisseur branché.
  const codeDevMock = process.env.NODE_ENV !== "production" ? code : undefined;

  return NextResponse.json({ envoye: true, codeDevMock });
}
