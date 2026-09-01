import { prisma } from "@/lib/prisma";
import { getSmsProvider } from "@/lib/sms";
import { DELAI_GRACE_JOURS, SEUIL_INACTIVITE_JOURS, ilYaJours } from "./config";

/**
 * Détection d'inactivité (§2.9.1) — pensé pour tourner une fois par semaine sur
 * le worker. Un compte `ACTIF` dont `derniereActiviteLe` (ou, à défaut,
 * `createdAt`) dépasse le seuil passe `INACTIF_NOTIFIE`, on horodate
 * `dateNotificationInactivite`, on prévient par SMS le(s) parent(s) lié(s) — ou
 * l'élève via son propre numéro de paiement à défaut — et on journalise
 * `COMPTE_INACTIF_DETECTE`.
 *
 * Idempotent : ne traite que les comptes encore `ACTIF`, donc un second passage
 * dans la même semaine ne re-notifie personne.
 */

export interface ResultatDetectionInactivite {
  seuilJours: number;
  comptesTraites: number;
  smsEnvoyes: number;
  comptesSansCanal: number;
}

async function numerosANotifier(eleveId: string): Promise<string[]> {
  const liens = await prisma.parentEleveLink.findMany({
    where: { eleveId },
    select: { parent: { select: { telephone: true } } },
  });
  if (liens.length > 0) {
    return [...new Set(liens.map((l) => l.parent.telephone))];
  }
  // Pas de lien parent vérifié : repli sur le dernier numéro ayant payé en tant
  // qu'élève pour ce compte (l'élève n'a pas de téléphone propre en base).
  const paiement = await prisma.paiement.findFirst({
    where: { payeurRole: "ELEVE", abonnement: { eleveId } },
    orderBy: { datePaiement: "desc" },
    select: { payeurTelephone: true },
  });
  return paiement ? [paiement.payeurTelephone] : [];
}

export async function detecterInactivite(maintenant: Date = new Date()): Promise<ResultatDetectionInactivite> {
  const seuil = ilYaJours(SEUIL_INACTIVITE_JOURS, maintenant);

  const candidats = await prisma.eleve.findMany({
    where: {
      statutCompte: "ACTIF",
      OR: [{ derniereActiviteLe: { lt: seuil } }, { derniereActiviteLe: null, createdAt: { lt: seuil } }],
    },
    select: { id: true, nom: true },
  });

  const sms = getSmsProvider();
  let smsEnvoyes = 0;
  let comptesSansCanal = 0;

  for (const eleve of candidats) {
    await prisma.eleve.update({
      where: { id: eleve.id },
      data: { statutCompte: "INACTIF_NOTIFIE", dateNotificationInactivite: maintenant },
    });

    const numeros = await numerosANotifier(eleve.id);
    for (const numero of numeros) {
      try {
        await sms.envoyerAlerteInactivite(numero, eleve.nom, DELAI_GRACE_JOURS);
        smsEnvoyes += 1;
      } catch {
        // L'envoi mock ne lève jamais ; en réel, l'échec d'un SMS ne doit pas
        // empêcher de traiter les comptes suivants.
      }
    }
    if (numeros.length === 0) comptesSansCanal += 1;

    await prisma.auditLogSecurite.create({
      data: {
        typeEvenement: "COMPTE_INACTIF_DETECTE",
        utilisateurId: eleve.id,
        details: {
          seuilInactiviteJours: SEUIL_INACTIVITE_JOURS,
          delaiGraceJours: DELAI_GRACE_JOURS,
          numerosNotifies: numeros.length,
        },
      },
    });
  }

  return {
    seuilJours: SEUIL_INACTIVITE_JOURS,
    comptesTraites: candidats.length,
    smsEnvoyes,
    comptesSansCanal,
  };
}
