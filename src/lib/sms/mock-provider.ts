import { randomUUID } from "node:crypto";
import type { SmsProvider } from "./provider";
import type { CategorieSms, DonneesRappelRenouvellement, DonneesResumeProgression, ResultatEnvoiSms } from "./types";
import { messageOtp, messageRappelRenouvellement } from "./messages";

/** Latence simulée d'une API SMS réelle — permet de tester les états "envoi en cours" côté UI. */
const MOCK_DELAI_MS = 300;

/**
 * Simule l'envoi de SMS sans fournisseur réel (§3, non souscrit). N'appelle
 * aucune API : logue le numéro destinataire et le contenu dans les logs du
 * conteneur au format `[SMS MOCK] Envoyé à <numéro> : <contenu>`, puis retourne
 * un succès simulé après un court délai. Permet de dérouler le parcours OTP
 * parent (§2.2) de bout en bout — le code est lisible dans les logs Docker.
 */
export class MockSmsProvider implements SmsProvider {
  async envoyerOtp(telephone: string, code: string, ttlMinutes: number): Promise<ResultatEnvoiSms> {
    return this.simuler(telephone, messageOtp(code, ttlMinutes), "OTP");
  }

  async envoyerRappelRenouvellement(
    telephone: string,
    donnees: DonneesRappelRenouvellement
  ): Promise<ResultatEnvoiSms> {
    return this.simuler(telephone, messageRappelRenouvellement(donnees), "RAPPEL_RENOUVELLEMENT");
  }

  async envoyerResumeProgression(
    telephone: string,
    donnees: DonneesResumeProgression
  ): Promise<ResultatEnvoiSms> {
    return this.simuler(telephone, donnees.corps, "RESUME_PROGRESSION");
  }

  private async simuler(telephone: string, contenu: string, categorie: CategorieSms): Promise<ResultatEnvoiSms> {
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAI_MS));
    console.log(`[SMS MOCK] Envoyé à ${telephone} (${categorie}) : ${contenu}`);
    return { messageId: `mock-sms-${randomUUID()}`, statut: "ENVOYE" };
  }
}
