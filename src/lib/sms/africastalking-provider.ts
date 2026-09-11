import type { SmsProvider } from "./provider";
import type { CategorieSms, DonneesRappelRenouvellement, DonneesResumeProgression, ResultatEnvoiSms } from "./types";
import { SmsEnvoiError } from "./types";
import { messageAlerteInactivite, messageOtp, messageRappelRenouvellement } from "./messages";

/**
 * Intégration Africa's Talking réelle (remplace Orange SMS Cameroun — jamais
 * implémenté, jamais souscrit — dont la propre FAQ documente un problème de
 * livraison vers les numéros MTN ; Africa's Talking couvre nativement MTN et
 * Orange au Cameroun). Implémentée en appel REST direct plutôt qu'avec le SDK
 * npm officiel `africastalking` (v0.8.3) : ce SDK n'a pas de types TypeScript
 * et embarque une chaîne de dépendances à risque (`grpc@^1.24.3` — bindings
 * natifs dépréciés, `axios@^0.21.1` avec CVEs connues, `unirest@^0.6.0`
 * abandonné, `@hapi/joi@^16.1.7` déprécié). Le contrat REST ci-dessous est
 * extrait du code source de ce même SDK (`lib/common.js` + `lib/sms.js`,
 * dépôt officiel `AfricasTalkingLtd/africastalking-node.js`), pas deviné :
 * seule sa couche transport est réimplémentée nativement via `fetch`.
 *
 * `POST {baseUrl}/messaging` — `baseUrl` = `https://api.sandbox.africastalking.com/version1`
 * en sandbox, `https://api.africastalking.com/version1` en live (déterminé par
 * `AFRICASTALKING_USERNAME === "sandbox"`, convention Africa's Talking : le
 * username sandbox est toujours littéralement `sandbox`). Headers `apiKey` +
 * `Accept: application/json` ; corps `application/x-www-form-urlencoded`
 * (`username`, `to`, `message`). Succès HTTP 201, corps
 * `{ SMSMessageData: { Recipients: [{ status, statusCode, messageId, ... }] } }`
 * — chaque destinataire a son propre statut, `"Success"` étant la seule valeur
 * de succès (cf. `mapperResultat`).
 *
 * En sandbox, Africa's Talking ne délivre **jamais** un SMS à un vrai
 * téléphone, quelle que soit la configuration — le message n'atteint que leur
 * simulateur web (`simulator.africastalking.com`), confirmé par leur propre
 * centre d'aide. Seule la réponse API (HTTP 201 + statut par destinataire) est
 * donc vérifiable en sandbox ; la livraison réelle à un téléphone ne pourra
 * être testée qu'en production avec des clés live.
 */
const AFRICASTALKING_SANDBOX_USERNAME = "sandbox";

function baseUrl(username: string): string {
  return username === AFRICASTALKING_SANDBOX_USERNAME
    ? "https://api.sandbox.africastalking.com/version1"
    : "https://api.africastalking.com/version1";
}

function envObligatoire(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) {
    throw new Error(`Configuration Africa's Talking incomplète : ${nom} manquante (cf. .env.example section Africa's Talking).`);
  }
  return valeur;
}

interface AfricasTalkingRecipient {
  statusCode: number;
  number: string;
  status: string;
  cost?: string;
  messageId?: string;
}

interface AfricasTalkingSmsResponse {
  SMSMessageData: {
    Message: string;
    Recipients: AfricasTalkingRecipient[];
  };
}

async function texteErreur(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "(corps illisible)";
  }
}

export class AfricasTalkingProvider implements SmsProvider {
  private readonly username: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.username = envObligatoire("AFRICASTALKING_USERNAME");
    this.apiKey = envObligatoire("AFRICASTALKING_API_KEY");
    this.baseUrl = baseUrl(this.username);
  }

  async envoyerOtp(telephone: string, code: string, ttlMinutes: number): Promise<ResultatEnvoiSms> {
    return this.envoyer(telephone, messageOtp(code, ttlMinutes), "OTP");
  }

  async envoyerRappelRenouvellement(
    telephone: string,
    donnees: DonneesRappelRenouvellement
  ): Promise<ResultatEnvoiSms> {
    return this.envoyer(telephone, messageRappelRenouvellement(donnees), "RAPPEL_RENOUVELLEMENT");
  }

  async envoyerResumeProgression(
    telephone: string,
    donnees: DonneesResumeProgression
  ): Promise<ResultatEnvoiSms> {
    return this.envoyer(telephone, donnees.corps, "RESUME_PROGRESSION");
  }

  async envoyerAlerteInactivite(
    telephone: string,
    prenomEleve: string,
    joursAvantAnonymisation: number
  ): Promise<ResultatEnvoiSms> {
    return this.envoyer(telephone, messageAlerteInactivite(prenomEleve, joursAvantAnonymisation), "ALERTE_INACTIVITE");
  }

  private async envoyer(telephone: string, message: string, categorie: CategorieSms): Promise<ResultatEnvoiSms> {
    const corps = new URLSearchParams({ username: this.username, to: telephone, message });

    const res = await fetch(`${this.baseUrl}/messaging`, {
      method: "POST",
      headers: {
        apiKey: this.apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: corps,
    });

    if (res.status !== 201) {
      throw new SmsEnvoiError(`Échec d'envoi Africa's Talking (${categorie}, HTTP ${res.status}) : ${await texteErreur(res)}`);
    }

    const data = (await res.json()) as AfricasTalkingSmsResponse;
    const destinataire = data.SMSMessageData.Recipients[0];
    if (!destinataire) {
      throw new SmsEnvoiError(`Réponse Africa's Talking sans destinataire (${categorie}) — payload inattendu.`);
    }

    return {
      messageId: destinataire.messageId ?? "",
      statut: destinataire.status === "Success" ? "ENVOYE" : "ECHEC",
    };
  }
}
