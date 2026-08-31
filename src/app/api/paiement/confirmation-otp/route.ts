import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { envoyerOtp } from "@/lib/auth/otp";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Envoie l'OTP de re-vérification légère avant validation d'un paiement pour
 * un parent déjà connecté (§2.6, §5.4). Distinct de
 * `/api/auth/parent/request-otp` (pré-connexion, téléphone fourni par le
 * client) : ici l'appelant est déjà authentifié, donc le téléphone vient de
 * la session côté serveur, jamais du corps de la requête — un parent ne peut
 * déclencher l'envoi que vers son propre numéro vérifié.
 */
const LIMIT = 5;
const WINDOW_SECONDS = 15 * 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "PARENT" || !session.user.telephone) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const [okParent, okIp] = await Promise.all([
    checkRateLimit(`paiement-otp:parent:${session.user.id}`, LIMIT, WINDOW_SECONDS),
    checkRateLimit(`paiement-otp:ip:${ip}`, LIMIT, WINDOW_SECONDS),
  ]);
  if (!okParent || !okIp) {
    return NextResponse.json({ error: "Trop de tentatives, réessaie plus tard." }, { status: 429 });
  }

  const { codeDevMock } = await envoyerOtp(session.user.telephone);
  return NextResponse.json({ envoye: true, codeDevMock });
}
