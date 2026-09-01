/**
 * Types partagés de l'abstraction StorageProvider (cahier des charges §3, §4.2,
 * §4.3). Même logique que AIProvider (§6.2), PaymentProvider (§5.1) et
 * SmsProvider (§3) : tout le code applicatif passe par cette interface, jamais
 * par un SDK de stockage. Cloudflare R2 (clés pas encore obtenues) sera un
 * `R2StorageProvider` déposé plus tard sans réécrire les appelants.
 *
 * Règle CLAUDE.md / réf. sécurité : on ne stocke jamais d'URL publique en base,
 * seulement une `key` opaque ; la lecture se fait toujours par URL signée
 * expirante (jamais de bucket public).
 */

/** Préfixe logique de rangement — devient un préfixe de clé R2 le moment venu. */
export type DossierStockage = "epreuves" | "corriges" | "copies";

export interface FichierAUploader {
  dossier: DossierStockage;
  /** Nom d'origine côté client — sert seulement à déduire l'extension, jamais utilisé tel quel comme clé. */
  nomOriginal: string;
  contentType: string;
  contenu: Buffer | Uint8Array;
}

export interface ResultatUpload {
  /** Clé opaque à stocker en base (ex. `epreuves/9f3c….pdf`). Jamais une URL. */
  key: string;
  taille: number;
}

/** Levée pour toute erreur de stockage non récupérable. */
export class StorageError extends Error {
  constructor(message = "Échec de l'opération de stockage") {
    super(message);
    this.name = "StorageError";
  }
}
