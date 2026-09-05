import { NextResponse } from "next/server";
import { exigerRole } from "@/lib/auth/api-guard";
import { chargerPaiementAutorise } from "@/lib/payment/idor";

/**
 * Statut d'un paiement (§17 — écran "Vérification du paiement"), interrogé
 * par polling côté client.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const garde = await exigerRole(["ELEVE", "PARENT"]);
  if (!garde.ok) return garde.response;

  const paiement = await chargerPaiementAutorise(id, garde.session);
  if (!paiement) {
    return NextResponse.json({ error: "Paiement introuvable." }, { status: 404 });
  }

  return NextResponse.json({
    statut: paiement.statut,
    montant: paiement.montant,
    devise: paiement.devise,
    abonnementPlan: paiement.abonnement.plan,
    abonnementStatut: paiement.abonnement.statut,
  });
}
