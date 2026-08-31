import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { chargerPaiementAutorise } from "@/lib/payment/idor";

/**
 * Statut d'un paiement (§17 — écran "Vérification du paiement"), interrogé
 * par polling côté client.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.error || (session.user.role !== "ELEVE" && session.user.role !== "PARENT")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const paiement = await chargerPaiementAutorise(id, session);
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
