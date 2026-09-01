import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "./provider";
import { StorageError, type FichierAUploader, type ResultatUpload } from "./types";

/**
 * Stockage réel sur Cloudflare R2 (cahier des charges §3, §4.2, §4.3), via l'API
 * S3-compatible de R2. Sélectionné par `STORAGE_MODE=r2` (cf.
 * `src/lib/storage/index.ts`). Même interface que `MockStorageProvider` — les
 * appelants (routes admin, futur pipeline de correction) ne changent pas.
 *
 * Règle CLAUDE.md / réf. sécurité : le bucket n'est jamais public. On ne stocke
 * en base que la `key` opaque ; toute lecture passe par une URL signée expirante
 * générée à la demande par `obtenirUrlSignee` (presigned GET, S3 SigV4).
 */

const EXPIRATION_DEFAUT_S = 15 * 60;
const EXPIRATION_MAX_S = 7 * 24 * 60 * 60; // borne SigV4 pour une URL présignée

const EXTENSION_PAR_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function extensionDepuis(fichier: FichierAUploader): string {
  const parType = EXTENSION_PAR_TYPE[fichier.contentType];
  if (parType) return parType;
  const parNom = path.extname(fichier.nomOriginal).replace(/^\./, "").toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(parNom) ? parNom : "bin";
}

/** Lit une variable d'environnement obligatoire, sinon lève une `StorageError` claire. */
function envObligatoire(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) {
    throw new StorageError(
      `Configuration R2 incomplète : ${nom} manquante (cf. .env.example section Cloudflare R2).`
    );
  }
  return valeur;
}

export class R2StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const accountId = envObligatoire("R2_ACCOUNT_ID");
    this.bucket = envObligatoire("R2_BUCKET");
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: envObligatoire("R2_ACCESS_KEY_ID"),
        secretAccessKey: envObligatoire("R2_SECRET_ACCESS_KEY"),
      },
    });
  }

  async uploader(fichier: FichierAUploader): Promise<ResultatUpload> {
    const key = `${fichier.dossier}/${randomUUID()}.${extensionDepuis(fichier)}`;
    const contenu = Buffer.isBuffer(fichier.contenu)
      ? fichier.contenu
      : Buffer.from(fichier.contenu);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: contenu,
          ContentType: fichier.contentType,
        })
      );
    } catch (cause) {
      throw new StorageError(`Échec de l'upload R2 (${key}) : ${(cause as Error).message}`);
    }

    console.log(`[STORAGE R2] Fichier déposé : ${key} (${contenu.length} octets)`);
    return { key, taille: contenu.length };
  }

  async obtenirUrlSignee(key: string, expiresInSeconds = EXPIRATION_DEFAUT_S): Promise<string> {
    const expiresIn = Math.min(Math.max(1, Math.floor(expiresInSeconds)), EXPIRATION_MAX_S);
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn }
      );
    } catch (cause) {
      throw new StorageError(
        `Échec de génération d'URL signée R2 (${key}) : ${(cause as Error).message}`
      );
    }
  }

  async supprimer(key: string): Promise<void> {
    try {
      // DeleteObject sur S3/R2 est idempotent : pas d'erreur si la clé n'existe plus.
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (cause) {
      throw new StorageError(`Échec de suppression R2 (${key}) : ${(cause as Error).message}`);
    }
  }
}
