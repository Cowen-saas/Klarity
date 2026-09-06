import { NextResponse } from "next/server";
import { z } from "zod";
import { envoyerOtp } from "@/lib/auth/otp";
import { checkRateLimit } from "@/lib/rate-limit";
import { normaliserTelephoneCamerounais } from "@/lib/format";

/**
 * Envoi de l'OTP SMS pour la connexion parent (§2.2, §2.7). Rate limiting IP +
 * téléphone, les deux (réf. sécurité §2, cahier des charges §7). L'envoi passe
 * par `SmsProvider` (`src/lib/sms`, via `envoyerOtp`) : `SMS_MODE=mock` logue le
 * message, `SMS_MODE=live` enverra un vrai SMS dès souscription du fournisseur
 * (§3).
 *
 * Le numéro est **normalisé** en forme canonique `+2376XXXXXXXX` avant tout
 * usage — même valeur que celle recherchée par `authorize` (`src/auth.ts`) et
 * que `Parent.telephone`, quels que soient les espaces / préfixes tapés.
 */
const bodySchema = z.object({
  telephone: z.string().min(1),
});

const LIMIT = 5;
const WINDOW_SECONDS = 15 * 60;

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Numéro de téléphone invalide." }, { status: 400 });
  }

  const telephone = normaliserTelephoneCamerounais(parsed.data.telephone);
  if (!telephone) {
    return NextResponse.json({ error: "Numéro de téléphone camerounais invalide (+237 6XX XX XX XX)." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const [okTelephone, okIp] = await Promise.all([
    checkRateLimit(`otp:tel:${telephone}`, LIMIT, WINDOW_SECONDS),
    checkRateLimit(`otp:ip:${ip}`, LIMIT, WINDOW_SECONDS),
  ]);
  if (!okTelephone || !okIp) {
    return NextResponse.json({ error: "Trop de tentatives, réessayez plus tard." }, { status: 429 });
  }

  const { codeDevMock } = await envoyerOtp(telephone);

  return NextResponse.json({ envoye: true, codeDevMock });
}
