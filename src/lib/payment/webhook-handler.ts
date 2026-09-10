import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payment";

/**
 * Traitement d'un webhook de paiement (§5.4) — point d'entrée unique partagé
 * par le vrai endpoint HTTP (`/api/paiement/webhook`, celui que NotchPay
 * appellera) et par le job BullMQ qui simule l'arrivée asynchrone du webhook
 * en mode mock (§5.2 : « pop-up de confirmation branché sur MockPaymentProvider
 * qui simule REUSSI/ECHEC après un court délai »). Partager cette fonction
 * garantit qu'aucun retravail de l'endpoint n'est nécessaire au changement de
 * provider — seul PaymentProvider change (§5.3).
 *
 * Idempotence stricte (§4.5, §5.4, §8) : un même événement rejoué (retry
 * réseau NotchPay, ou le même job mock relancé) ne crédite jamais deux fois —
 * dès que Paiement.statut a quitté EN_ATTENTE, tout replay est un no-op
 * journalisé, jamais une seconde écriture sur Abonnement.
 */

const DUREE_ABONNEMENT_JOURS = 30;

export type ResultatTraitementWebhook =
  | { ok: true; traitementStatut: "CREDITE" | "ECHEC_PAIEMENT" | "DEJA_TRAITE" | "EVENEMENT_INTERMEDIAIRE" }
  | { ok: false; traitementStatut: "SIGNATURE_INVALIDE" | "PAIEMENT_INTROUVABLE"; status: 401 | 404 };

export async function traiterWebhookPaiement(
  payloadBrut: unknown,
  signatureRecue: string
): Promise<ResultatTraitementWebhook> {
  const provider = getPaymentProvider();
  // Journalisé explicitement (plutôt que de laisser jouer le défaut "CAMERPAY"
  // du schéma, faux depuis le passage à NotchPay) — reflète le provider
  // effectivement actif au moment du traitement.
  const nomProvider = (process.env.PAYMENT_MODE ?? "mock").toUpperCase();

  if (!provider.verifierSignatureWebhook(payloadBrut, signatureRecue)) {
    await Promise.all([
      prisma.webhookLog.create({
        data: { provider: nomProvider, payloadBrut: asJson(payloadBrut), signatureValide: false, traitementStatut: "SIGNATURE_INVALIDE" },
      }),
      prisma.auditLogSecurite.create({ data: { typeEvenement: "WEBHOOK_INVALID" } }),
    ]);
    return { ok: false, traitementStatut: "SIGNATURE_INVALIDE", status: 401 };
  }

  const resultat = await provider.traiterWebhook(payloadBrut);

  const paiement = await prisma.paiement.findUnique({
    where: { idempotencyKey: resultat.idempotencyKey },
    select: { id: true, statut: true, abonnementId: true },
  });

  if (!paiement) {
    await prisma.webhookLog.create({
      data: {
        provider: nomProvider,
        payloadBrut: asJson(payloadBrut),
        signatureValide: true,
        traitementStatut: "PAIEMENT_INTROUVABLE",
      },
    });
    return { ok: false, traitementStatut: "PAIEMENT_INTROUVABLE", status: 404 };
  }

  if (paiement.statut !== "EN_ATTENTE") {
    // Replay d'un webhook déjà traité (retry réseau, ou job mock rejoué) —
    // no-op volontaire, aucune seconde écriture sur Abonnement.
    await prisma.webhookLog.create({
      data: { provider: nomProvider, payloadBrut: asJson(payloadBrut), signatureValide: true, traitementStatut: "DEJA_TRAITE" },
    });
    return { ok: true, traitementStatut: "DEJA_TRAITE" };
  }

  if (resultat.statut === "EN_ATTENTE") {
    // Événement intermédiaire (ex. NotchPay "processing") — pas encore un
    // état terminal : journalisé pour audit, mais ni Paiement ni Abonnement ne
    // sont modifiés. Le paiement reste EN_ATTENTE jusqu'au prochain webhook
    // terminal (REUSSI/ECHEC).
    await prisma.webhookLog.create({
      data: { provider: nomProvider, payloadBrut: asJson(payloadBrut), signatureValide: true, traitementStatut: "EVENEMENT_INTERMEDIAIRE" },
    });
    return { ok: true, traitementStatut: "EVENEMENT_INTERMEDIAIRE" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.paiement.update({
      where: { id: paiement.id },
      data: { statut: resultat.statut, referenceCamerPay: resultat.referenceCamerPay },
    });

    if (resultat.statut === "REUSSI") {
      const maintenant = new Date();
      const dateFin = new Date(maintenant.getTime() + DUREE_ABONNEMENT_JOURS * 24 * 60 * 60 * 1000);
      await tx.abonnement.update({
        where: { id: paiement.abonnementId },
        data: {
          plan: "PREMIUM",
          statut: "ACTIF",
          dateDebut: maintenant,
          dateFin,
          prixApplique: resultat.montant,
          dateProchainRenouvellement: dateFin,
          rappelEnvoye: false,
        },
      });
    }
  });

  await prisma.webhookLog.create({
    data: {
      provider: nomProvider,
      payloadBrut: asJson(payloadBrut),
      signatureValide: true,
      traitementStatut: resultat.statut === "REUSSI" ? "CREDITE" : "ECHEC_PAIEMENT",
    },
  });

  return { ok: true, traitementStatut: resultat.statut === "REUSSI" ? "CREDITE" : "ECHEC_PAIEMENT" };
}

function asJson(value: unknown): object {
  return value && typeof value === "object" ? (value as object) : { valeur: value };
}
