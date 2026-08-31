import { NextResponse } from "next/server";
import { traiterWebhookPaiement } from "@/lib/payment/webhook-handler";

/**
 * Endpoint HTTP réel que CamerPay appellera en sandbox/live (§5.3) — déjà
 * fonctionnel aujourd'hui : en PAYMENT_MODE=mock, c'est le job BullMQ
 * (src/worker/index.ts) qui simule l'appel externe en invoquant directement
 * traiterWebhookPaiement(), donc cet endpoint n'est pas encore exercé en
 * pratique, mais aucun retravail ne sera nécessaire à la bascule (§5.1).
 * Aucun payload non signé n'est jamais traité, même en cas de doute (§5.4).
 */
export async function POST(request: Request) {
  const signature = request.headers.get("x-camerpay-signature") ?? "";
  const payloadBrut = await request.json().catch(() => null);
  if (payloadBrut === null) {
    return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
  }

  const resultat = await traiterWebhookPaiement(payloadBrut, signature);
  if (!resultat.ok) {
    return NextResponse.json({ error: resultat.traitementStatut }, { status: resultat.status });
  }
  return NextResponse.json({ traitementStatut: resultat.traitementStatut });
}
