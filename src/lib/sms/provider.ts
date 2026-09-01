import type { DonneesRappelRenouvellement, DonneesResumeProgression, ResultatEnvoiSms } from "./types";

/**
 * Interface SmsProvider (cahier des charges §2.2, §2.2.3, §3, §5.5) — même
 * logique d'abstraction que `AIProvider` (§6.2) et `PaymentProvider` (§5.1) :
 * tout le code applicatif (route API, job BullMQ) passe exclusivement par cette
 * interface, jamais par un appel direct à une API SMS. Sélection au démarrage
 * via `SMS_MODE = mock | live` (cf. `src/lib/sms/index.ts`). Le provider réel
 * (Orange SMS Cameroun ou Africa's Talking) arrivera dès souscription — une
 * nouvelle classe + un changement de config, sans réécriture des appelants.
 *
 * Trois méthodes pour les trois usages SMS sortants prévus. Seul (a) est
 * réellement câblé aujourd'hui ; (b) et (c) sont posés pour des jobs BullMQ pas
 * encore construits (rappels de renouvellement §5.5, résumés de progression
 * §2.2.3 — hors scope actuel, cf. `docs/PROGRESS.md`).
 */
export interface SmsProvider {
  /** (a) OTP de connexion parent (§2.2). Transactionnel, priorité haute. */
  envoyerOtp(telephone: string, code: string, ttlMinutes: number): Promise<ResultatEnvoiSms>;

  /** (b) Rappel de renouvellement d'abonnement (§5.5). Déclencheur BullMQ à venir. */
  envoyerRappelRenouvellement(
    telephone: string,
    donnees: DonneesRappelRenouvellement
  ): Promise<ResultatEnvoiSms>;

  /**
   * (c) Résumé de progression selon les préférences de notification (§2.2.3).
   * Déclencheur BullMQ à venir ; le corps du message est composé par le job.
   */
  envoyerResumeProgression(
    telephone: string,
    donnees: DonneesResumeProgression
  ): Promise<ResultatEnvoiSms>;

  /**
   * (d) Alerte d'inactivité avant anonymisation du compte élève (§2.9.1),
   * envoyée au parent lié (ou à l'élève à défaut) par le job hebdomadaire de
   * détection d'inactivité.
   */
  envoyerAlerteInactivite(
    telephone: string,
    prenomEleve: string,
    joursAvantAnonymisation: number
  ): Promise<ResultatEnvoiSms>;
}
