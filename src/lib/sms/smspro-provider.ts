import type { SmsProvider } from "./provider";
import type { CategorieSms, DonneesRappelRenouvellement, DonneesResumeProgression, ResultatEnvoiSms } from "./types";
import { SmsEnvoiError } from "./types";
import { messageAlerteInactivite, messageOtp, messageRappelRenouvellement } from "./messages";

/**
 * Intégration SmsPro réelle (remplace Africa's Talking — cf. `docs/PROGRESS.md`,
 * entrée sur ce remplacement : couvre nativement MTN + Orange + Camtel, propose
 * un paiement local en Mobile Money, et évite le souci de livraison MTN identifié
 * par ailleurs). Contrat REST extrait de la documentation publique et vérifiée en
 * session, `https://v2.smspro.cm/docs/api` (page publique, pas de SDK npm officiel
 * disponible) — pas deviné.
 *
 * `POST {baseUrl}/api/v1/messages`, JSON `{ to, message, from }`. Authentification
 * `Authorization: Bearer <clé>` (méthode recommandée par SmsPro ; l'alternative
 * `?api_key=` documentée n'est prévue que pour des connecteurs tiers incapables de
 * poser un en-tête personnalisé — non utilisée ici). Succès HTTP 201 ; erreurs en
 * JSON `{ error, message }` (401/402/404/422/429 documentés, gérés uniformément
 * ci-dessous par le code HTTP).
 *
 * `from` doit être un Sender ID déjà déclaré sur le compte SmsPro. La doc
 * recommande explicitement un Sender ID dédié à l'usage "OTP" (déclaré comme tel
 * lors de la demande, distinct d'un Sender ID "Marketing") pour un acheminement
 * correct par les opérateurs — d'où `SMSPRO_SENDER_ID_OTP`, optionnel et replié
 * sur `SMSPRO_SENDER_ID` si l'élève/parent n'a pas encore enregistré de second
 * Sender ID dédié.
 *
 * Champ retourné pour l'identifiant de message côté SmsPro : **non documenté**
 * (aucun exemple de corps de réponse en cas de succès dans la doc publique,
 * seulement le code HTTP 201). `extraireMessageId` essaie les noms de champ
 * plausibles (`id`, `messageId`, `message_id`, `uuid`) et retombe sur une chaîne
 * vide sinon — non bloquant, ce champ n'est que de la métadonnée de suivi, jamais
 * utilisé pour décider `ENVOYE`/`ECHEC` (déterminé uniquement par le code HTTP).
 * À confirmer avec un envoi réel (cf. `docs/PROGRESS.md`).
 */
const SMSPRO_BASE_URL = "https://v2.smspro.cm";

function envObligatoire(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) {
    throw new Error(`Configuration SmsPro incomplète : ${nom} manquante (cf. .env.example section SmsPro).`);
  }
  return valeur;
}

interface SmsProErrorBody {
  error?: string;
  message?: string;
}

async function texteErreur(res: Response): Promise<string> {
  try {
    const data = (await res.clone().json()) as SmsProErrorBody;
    if (data.message || data.error) {
      return data.message ?? data.error ?? "";
    }
  } catch {
    // corps non-JSON — repli sur le texte brut ci-dessous
  }
  try {
    return await res.text();
  } catch {
    return "(corps illisible)";
  }
}

function extraireMessageId(data: unknown): string {
  if (typeof data !== "object" || data === null) {
    return "";
  }
  const objet = data as Record<string, unknown>;
  const candidat = objet.id ?? objet.messageId ?? objet.message_id ?? objet.uuid;
  return typeof candidat === "string" ? candidat : "";
}

export class SmsProProvider implements SmsProvider {
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly senderIdOtp: string;

  constructor() {
    this.apiKey = envObligatoire("SMSPRO_API_KEY");
    this.senderId = envObligatoire("SMSPRO_SENDER_ID");
    this.senderIdOtp = process.env.SMSPRO_SENDER_ID_OTP || this.senderId;
  }

  async envoyerOtp(telephone: string, code: string, ttlMinutes: number): Promise<ResultatEnvoiSms> {
    return this.envoyer(telephone, messageOtp(code, ttlMinutes), "OTP", this.senderIdOtp);
  }

  async envoyerRappelRenouvellement(
    telephone: string,
    donnees: DonneesRappelRenouvellement
  ): Promise<ResultatEnvoiSms> {
    return this.envoyer(telephone, messageRappelRenouvellement(donnees), "RAPPEL_RENOUVELLEMENT", this.senderId);
  }

  async envoyerResumeProgression(
    telephone: string,
    donnees: DonneesResumeProgression
  ): Promise<ResultatEnvoiSms> {
    return this.envoyer(telephone, donnees.corps, "RESUME_PROGRESSION", this.senderId);
  }

  async envoyerAlerteInactivite(
    telephone: string,
    prenomEleve: string,
    joursAvantAnonymisation: number
  ): Promise<ResultatEnvoiSms> {
    return this.envoyer(
      telephone,
      messageAlerteInactivite(prenomEleve, joursAvantAnonymisation),
      "ALERTE_INACTIVITE",
      this.senderId
    );
  }

  private async envoyer(
    telephone: string,
    message: string,
    categorie: CategorieSms,
    from: string
  ): Promise<ResultatEnvoiSms> {
    const res = await fetch(`${SMSPRO_BASE_URL}/api/v1/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: telephone, message, from }),
    });

    if (res.status !== 201) {
      throw new SmsEnvoiError(`Échec d'envoi SmsPro (${categorie}, HTTP ${res.status}) : ${await texteErreur(res)}`);
    }

    const data: unknown = await res.json().catch(() => undefined);
    return { messageId: extraireMessageId(data), statut: "ENVOYE" };
  }
}
