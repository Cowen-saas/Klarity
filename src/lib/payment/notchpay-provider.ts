import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "./provider";
import type { MethodePaiement, OperateurMobileMoney, PaiementSession, Payeur, ResultatPaiement, StatutPaiement } from "./types";

/**
 * Intégration NotchPay réelle (cahier des charges §5.3) — l'unique agrégateur
 * Mobile Money du projet (v1.32 ; corrigé le 11 septembre 2026 après premier
 * paiement sandbox réel — cf. journal §41. Le CDC v1.32 décrit encore le
 * comportement supposé avant test réel, pas encore mis à jour). Implémentée
 * d'abord à partir de la doc publique NotchPay (developer.notchpay.co), puis
 * **corrigée contre le comportement
 * réel observé** : `POST /payments` renvoie un objet `transaction` (pas une
 * chaîne), et cet objet n'a **pas** de champ `id` — seul `reference` (format
 * `trx.test_…`/`trx.…`) identifie la transaction, contrairement à l'exemple
 * générique de la doc qui montrait `id` ET `reference`. Le webhook suit la
 * même convention par cohérence (non confirmé par un webhook réel reçu — pas
 * de tunnel public exposé volontairement, cf. journal — mais `data.id` est
 * gardé en repli défensif si NotchPay l'envoie malgré tout pour cet event).
 *
 * Pas de distinction sandbox/live côté code : NotchPay expose une seule URL
 * d'API pour les deux (`https://api.notchpay.co`) — seul le préfixe de la clé
 * publique (`pk_test_…` / `pk_live_…`) distingue les deux, cf. `paiementsSontReels()`
 * dans `index.ts`.
 *
 * Flux d'initiation en 2 appels (doc "Accept payments — Mobile Money") :
 *  1. `POST /payments` crée la transaction (montant, devise, téléphone) et
 *     renvoie `transaction.reference` + une `authorization_url` de repli.
 *  2. `POST /payments/{reference}` avec `channel` (`cm.orange`/`cm.mtn`) +
 *     le téléphone déclenche l'invite USSD/app sur le téléphone du payeur —
 *     le paiement reste asynchrone, confirmé plus tard par webhook (§5.5),
 *     jamais par la réponse de cet appel.
 */
const NOTCHPAY_BASE_URL = process.env.NOTCHPAY_BASE_URL || "https://api.notchpay.co";

const CHANNEL_PAR_OPERATEUR: Record<OperateurMobileMoney, string> = {
  ORANGE: "cm.orange",
  MTN: "cm.mtn",
};

interface NotchPayInitResponse {
  transaction: {
    reference: string;
    status: string;
  };
  authorization_url?: string;
}

interface NotchPayWebhookPayload {
  id: string;
  type: string;
  data: {
    /** Champ réellement observé sur la ressource transaction (pas `id`, cf. commentaire de tête de fichier). */
    reference?: string;
    /** Gardé en repli défensif — jamais vu en pratique sur cette ressource, mais la doc générique le montre. */
    id?: string;
    amount: number;
    currency: string;
    status: string;
  };
}

function envObligatoire(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) {
    throw new Error(`Configuration NotchPay incomplète : ${nom} manquante (cf. .env.example section NotchPay).`);
  }
  return valeur;
}

/** Statuts NotchPay observés dans la doc webhook : complete/failed/canceled/expired/processing. */
function mapperStatutNotchPay(status: string): StatutPaiement {
  switch (status) {
    case "complete":
      return "REUSSI";
    case "failed":
    case "canceled":
    case "expired":
      return "ECHEC";
    default:
      // "processing" ou tout statut intermédiaire/inconnu — jamais traité comme
      // un échec par défaut (voir webhook-handler.ts, branche EN_ATTENTE : no-op
      // journalisé, en attente du prochain événement terminal).
      return "EN_ATTENTE";
  }
}

async function texteErreur(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "(corps illisible)";
  }
}

export class NotchPayProvider implements PaymentProvider {
  private readonly publicKey: string;
  private readonly webhookSecret: string;

  constructor() {
    this.publicKey = envObligatoire("NOTCHPAY_PUBLIC_KEY");
    this.webhookSecret = envObligatoire("NOTCHPAY_WEBHOOK_SECRET");
  }

  async initierPaiement(montant: number, devise: string, _methode: MethodePaiement, payeur: Payeur): Promise<PaiementSession> {
    void _methode; // seul MOBILE_MONEY existe (§5.1) — paramètre gardé pour respecter l'interface.
    if (!payeur.operateur) {
      throw new Error("Opérateur Mobile Money (ORANGE|MTN) requis pour initier un paiement NotchPay.");
    }

    const initRes = await fetch(`${NOTCHPAY_BASE_URL}/payments`, {
      method: "POST",
      headers: { Authorization: this.publicKey, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: montant, currency: devise, phone: payeur.telephone, description: "Abonnement Klarity Premium" }),
    });
    if (!initRes.ok) {
      throw new Error(`Échec d'initialisation NotchPay (${initRes.status}) : ${await texteErreur(initRes)}`);
    }
    const initData = (await initRes.json()) as NotchPayInitResponse;
    const reference = initData.transaction.reference;

    const chargeRes = await fetch(`${NOTCHPAY_BASE_URL}/payments/${reference}`, {
      method: "POST",
      headers: { Authorization: this.publicKey, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: CHANNEL_PAR_OPERATEUR[payeur.operateur], data: { phone: payeur.telephone } }),
    });
    if (!chargeRes.ok) {
      throw new Error(`Échec de déclenchement Mobile Money NotchPay (${chargeRes.status}) : ${await texteErreur(chargeRes)}`);
    }

    return {
      sessionId: reference,
      redirectUrl: initData.authorization_url,
      // Le Mobile Money ne confirme jamais de façon synchrone (§5.5) — le
      // statut réel arrive plus tard par webhook, jamais par cette réponse.
      statut: "EN_ATTENTE",
    };
  }

  verifierSignatureWebhook(payloadBrut: unknown, signatureRecue: string): boolean {
    if (!signatureRecue) return false;
    // NotchPay hash le JSON du corps brut avec le "Hash Key" webhook (HMAC-SHA256,
    // header `x-notch-signature`) — distinct des clés API.
    const signatureAttendue = createHmac("sha256", this.webhookSecret).update(JSON.stringify(payloadBrut)).digest("hex");
    const bufAttendu = Buffer.from(signatureAttendue);
    const bufRecu = Buffer.from(signatureRecue);
    return bufAttendu.length === bufRecu.length && timingSafeEqual(bufAttendu, bufRecu);
  }

  async traiterWebhook(payloadBrut: unknown): Promise<ResultatPaiement> {
    const { data } = payloadBrut as NotchPayWebhookPayload;
    // `reference` confirmé par un vrai POST /payments + GET /payments/{reference}
    // (11 septembre 2026, cf. journal) : l'objet transaction n'a pas de champ
    // `id`. `data.id` reste un repli défensif si jamais présent sur cet event,
    // pas l'hypothèse principale — la doc générique qui le montrait ne
    // correspond pas au comportement réel observé sur cette ressource.
    const reference = data.reference ?? data.id;
    if (!reference) {
      throw new Error("Webhook NotchPay sans data.reference ni data.id — payload inattendu, impossible d'associer un paiement.");
    }
    return {
      idempotencyKey: reference,
      statut: mapperStatutNotchPay(data.status),
      referenceTransaction: reference,
      montant: data.amount,
      devise: data.currency,
    };
  }
}
