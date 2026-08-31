import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

/**
 * Charge un Paiement en vérifiant l'appartenance de l'appelant (§8 — IDOR),
 * partagé entre `GET /api/paiement/[id]` (polling) et la page serveur
 * `/abonnement/verification/[id]` (évite un flash de chargement en
 * pré-chargeant le premier statut côté serveur). Un paiement n'a pas de
 * propriétaire direct — il faut remonter jusqu'à Abonnement.eleve : autorisé
 * si l'appelant est cet élève, ou un parent avec un ParentEleveLink vérifié
 * vers cet élève.
 */
export async function chargerPaiementAutorise(paiementId: string, session: Session) {
  const paiement = await prisma.paiement.findUnique({
    where: { id: paiementId },
    select: {
      id: true,
      statut: true,
      montant: true,
      devise: true,
      abonnement: { select: { eleveId: true, plan: true, statut: true } },
    },
  });
  if (!paiement) return null;

  const autorise =
    session.user.role === "ELEVE"
      ? paiement.abonnement.eleveId === session.user.id
      : session.user.role === "PARENT"
        ? await prisma.parentEleveLink
            .findUnique({
              where: { parentId_eleveId: { parentId: session.user.id, eleveId: paiement.abonnement.eleveId } },
              select: { id: true },
            })
            .then(Boolean)
        : false;

  if (!autorise) {
    await prisma.auditLogSecurite.create({
      data: { typeEvenement: "IDOR_BLOCKED", utilisateurId: session.user.id, details: { paiementId } },
    });
    return null;
  }

  return paiement;
}
