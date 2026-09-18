import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payment";
import { appliquerResultatPaiement } from "@/lib/payment/webhook-handler";

/**
 * Filet de sécurité pour un paiement resté EN_ATTENTE parce que le webhook du
 * provider ne s'est jamais livré (coupure réseau, tunnel local absent en
 * sandbox, retry épuisé côté provider en live) — sans ce job, ce blocage est
 * permanent : l'écran de vérification (`VerificationPoll.tsx`) poll
 * indéfiniment tant que `Paiement.statut` ne change pas, et rien d'autre ne le
 * changerait jamais. Déclenché en cron par le worker
 * (`src/lib/queue/reconciliation-paiement.ts`), jamais inline dans une route.
 *
 * Ne fait qu'interroger l'état déjà existant côté provider et rejouer le même
 * chemin de crédit idempotent que le webhook réel (`appliquerResultatPaiement`
 * dans `webhook-handler.ts`) — n'invente ni ne devine jamais un statut.
 */

/**
 * Délai avant qu'un paiement EN_ATTENTE soit considéré comme potentiellement
 * bloqué plutôt que simplement en cours de confirmation USSD par l'utilisateur
 * sur son téléphone (qui peut légitimement prendre une à deux minutes) — assez
 * long pour ne jamais interroger le provider pendant une confirmation normale
 * en cours, assez court pour rattraper un vrai blocage sans que l'utilisateur
 * n'ait à attendre indéfiniment.
 */
const SEUIL_MINUTES = 5;

export interface ResultatReconciliation {
  verifies: number;
  credites: number;
  echecs: number;
  toujoursEnAttente: number;
  erreurs: number;
}

export async function reconcilierPaiementsEnAttente(): Promise<ResultatReconciliation> {
  const provider = getPaymentProvider();
  const nomProvider = (process.env.PAYMENT_MODE ?? "mock").toUpperCase();
  const seuil = new Date(Date.now() - SEUIL_MINUTES * 60 * 1000);

  const paiements = await prisma.paiement.findMany({
    where: { statut: "EN_ATTENTE", datePaiement: { lt: seuil } },
    select: { idempotencyKey: true },
  });

  const stats: ResultatReconciliation = { verifies: 0, credites: 0, echecs: 0, toujoursEnAttente: 0, erreurs: 0 };

  for (const { idempotencyKey } of paiements) {
    stats.verifies++;
    try {
      const resultat = await provider.verifierStatutPaiement(idempotencyKey);
      const traitementStatut = await appliquerResultatPaiement(resultat, {
        nomProvider,
        payloadBrut: { source: "RECONCILIATION", reference: idempotencyKey, statutLu: resultat.statut },
        // Authentique par construction : cette lecture vient d'un appel que
        // *nous* avons fait vers le provider avec notre propre clé API, pas
        // d'un payload poussé de l'extérieur — aucune signature à vérifier ici.
        signatureValide: true,
      });
      if (traitementStatut === "CREDITE") stats.credites++;
      else if (traitementStatut === "ECHEC_PAIEMENT") stats.echecs++;
      else stats.toujoursEnAttente++;
    } catch (err) {
      console.error(`[reconciliation] échec interrogation provider pour ${idempotencyKey}`, err);
      stats.erreurs++;
    }
  }

  return stats;
}
