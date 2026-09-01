import type { DonneesRappelRenouvellement } from "./types";

/**
 * Composition du texte des SMS à gabarit fixe (OTP, rappel de renouvellement).
 * Isolé ici pour que le `MockSmsProvider` et le futur provider réel produisent
 * un libellé strictement identique — le provider est un transport, pas un
 * rédacteur. Le résumé de progression (§2.2.3) n'a pas de gabarit ici : son
 * corps est composé par le job appelant et passé tel quel.
 *
 * Contrainte SMS : rester en dessous de 160 caractères (un seul segment GSM-7)
 * pour les messages à gabarit fixe.
 */

/** (a) OTP de connexion parent (§2.2). */
export function messageOtp(code: string, ttlMinutes: number): string {
  return `Klarity : votre code de connexion est ${code}. Il expire dans ${ttlMinutes} minutes. Ne le communiquez a personne.`;
}

/** (b) Rappel de renouvellement d'abonnement (§5.5). */
export function messageRappelRenouvellement({ joursAvantExpiration, dateExpiration }: DonneesRappelRenouvellement): string {
  const date = dateExpiration.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const echeance =
    joursAvantExpiration <= 0
      ? "a expire"
      : joursAvantExpiration === 1
        ? "expire demain"
        : `expire dans ${joursAvantExpiration} jours`;
  return `Klarity : l'abonnement Premium ${echeance} (le ${date}). Renouvelez-le pour garder l'acces sans interruption.`;
}

/** (d) Alerte d'inactivité du compte élève avant anonymisation (§2.9.1). */
export function messageAlerteInactivite(prenomEleve: string, joursAvantAnonymisation: number): string {
  return (
    `Klarity : le compte de ${prenomEleve} est inactif. Sans nouvelle connexion sous ${joursAvantAnonymisation} jours, ` +
    `ses donnees pedagogiques seront definitivement supprimees.`
  );
}
