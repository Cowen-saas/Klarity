/**
 * Types partagés de l'abstraction SmsProvider (cahier des charges §2.2, §2.2.3,
 * §3, §5.5). Volontairement agnostiques du fournisseur : `MockSmsProvider` et le
 * futur provider réel (Orange SMS Cameroun ou Africa's Talking — non souscrit à
 * ce jour, §3) implémentent tous deux `SmsProvider` à partir de ces seules
 * formes. Rien ici ne doit présumer du format de payload d'une API SMS
 * particulière, encore inconnue.
 */

/**
 * Les trois catégories de SMS sortants prévues par le CDC. Un fournisseur réel
 * peut router chaque catégorie différemment (l'OTP est transactionnel et
 * prioritaire ; les rappels et résumés sont de la notification de masse, souvent
 * facturée et acheminée autrement) — d'où des méthodes distinctes sur
 * l'interface plutôt qu'un `envoyer()` générique.
 */
export type CategorieSms = "OTP" | "RAPPEL_RENOUVELLEMENT" | "RESUME_PROGRESSION";

export interface ResultatEnvoiSms {
  /** Identifiant de message du fournisseur — mock : un uuid ; réel : l'id renvoyé par l'API SMS. */
  messageId: string;
  statut: "ENVOYE" | "ECHEC";
}

/**
 * (b) Rappel de renouvellement d'abonnement (§5.5). Le job BullMQ qui le
 * déclenche n'est pas encore construit (hors scope, cf. `docs/PROGRESS.md` §15
 * point 5) — cette forme est posée d'avance pour lui et pourra être affinée
 * quand le job sera écrit.
 */
export interface DonneesRappelRenouvellement {
  joursAvantExpiration: number;
  dateExpiration: Date;
}

/**
 * (c) Résumé de progression selon les préférences de notification (§2.2.3). Le
 * job BullMQ qui le déclenche n'est pas encore construit. Le corps du message
 * est composé par le job appelant (il dépend des données de progression de
 * l'enfant) ; le provider ne fait que l'acheminer.
 */
export interface DonneesResumeProgression {
  /** Informe un éventuel routage/étiquetage côté fournisseur réel. */
  frequence: "HEBDOMADAIRE" | "MENSUEL" | "CRITIQUE_UNIQUEMENT";
  corps: string;
}

/** Levée quand un envoi échoue de façon non récupérable (mock : jamais). */
export class SmsEnvoiError extends Error {
  constructor(message = "Échec de l'envoi du SMS") {
    super(message);
    this.name = "SmsEnvoiError";
  }
}
