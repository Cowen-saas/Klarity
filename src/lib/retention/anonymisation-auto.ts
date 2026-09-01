import { prisma } from "@/lib/prisma";
import { DELAI_GRACE_JOURS, ilYaJours } from "./config";
import { anonymiserEleve } from "./anonymisation";

/**
 * Anonymisation automatique (§2.9.1, §2.9.2) — pensé pour tourner une fois par
 * semaine sur le worker, après la détection d'inactivité.
 *
 * Cible : les comptes `INACTIF_NOTIFIE` dont la notification date de plus de
 * `DELAI_GRACE_JOURS` et pour lesquels aucune activité n'a repris depuis
 * (`derniereActiviteLe` antérieur ou égal à la notification — la connexion
 * repasse sinon le compte `ACTIF`, cf. `src/auth.ts`).
 *
 * Idempotent : `anonymiserEleve` ne fait rien sur un compte déjà `ANONYMISE`,
 * et la requête ne sélectionne que des comptes `INACTIF_NOTIFIE`.
 */

export interface ResultatAnonymisationAuto {
  delaiGraceJours: number;
  comptesAnonymises: number;
  erreurs: number;
}

export async function anonymiserComptesExpires(maintenant: Date = new Date()): Promise<ResultatAnonymisationAuto> {
  const limiteNotification = ilYaJours(DELAI_GRACE_JOURS, maintenant);

  const aAnonymiser = await prisma.eleve.findMany({
    where: {
      statutCompte: "INACTIF_NOTIFIE",
      dateNotificationInactivite: { lt: limiteNotification },
    },
    select: { id: true, dateNotificationInactivite: true, derniereActiviteLe: true },
  });

  let comptesAnonymises = 0;
  let erreurs = 0;

  for (const eleve of aAnonymiser) {
    // Garde-fou : si une activité a repris après la notification sans que le
    // statut ait été remis à ACTIF (cas théorique), on ne touche pas au compte.
    if (
      eleve.derniereActiviteLe &&
      eleve.dateNotificationInactivite &&
      eleve.derniereActiviteLe > eleve.dateNotificationInactivite
    ) {
      continue;
    }
    try {
      await anonymiserEleve(eleve.id, { type: "AUTO" });
      comptesAnonymises += 1;
    } catch (err) {
      erreurs += 1;
      console.error(`[retention] échec anonymisation auto de l'élève ${eleve.id}`, err);
    }
  }

  return { delaiGraceJours: DELAI_GRACE_JOURS, comptesAnonymises, erreurs };
}
