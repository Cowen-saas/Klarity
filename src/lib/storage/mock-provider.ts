import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "./provider";
import { StorageError, type FichierAUploader, type ResultatUpload } from "./types";

/**
 * Stockage local sur disque, sans dépendance externe (§3, R2 pas encore
 * configuré). Les fichiers vont dans `.storage-mock/` à la racine du repo
 * (gitignoré, bind-mounté en dev donc persistant côté hôte). `obtenirUrlSignee`
 * imite une URL signée expirante R2 : un lien vers `/api/admin/storage` porteur
 * d'un HMAC + d'une échéance, refusé une fois expiré — jamais d'accès public
 * permanent.
 */

const RACINE_MOCK = path.join(process.cwd(), ".storage-mock");
const SECRET_SIGNATURE = process.env.STORAGE_MOCK_SIGNING_SECRET || "mock-storage-dev-secret";
const EXPIRATION_DEFAUT_S = 15 * 60;

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

function signer(payload: string): string {
  return createHmac("sha256", SECRET_SIGNATURE).update(payload).digest("hex");
}

/** Chemin disque absolu d'une clé, garanti à l'intérieur de `.storage-mock/`. */
function cheminDisque(key: string): string {
  const resolu = path.resolve(RACINE_MOCK, key);
  if (resolu !== RACINE_MOCK && !resolu.startsWith(RACINE_MOCK + path.sep)) {
    throw new StorageError("Clé de stockage invalide (hors du dossier autorisé).");
  }
  return resolu;
}

export class MockStorageProvider implements StorageProvider {
  async uploader(fichier: FichierAUploader): Promise<ResultatUpload> {
    const key = `${fichier.dossier}/${randomUUID()}.${extensionDepuis(fichier)}`;
    const cible = cheminDisque(key);
    await mkdir(path.dirname(cible), { recursive: true });
    const contenu = Buffer.isBuffer(fichier.contenu) ? fichier.contenu : Buffer.from(fichier.contenu);
    await writeFile(cible, contenu);
    console.log(`[STORAGE MOCK] Fichier déposé : ${key} (${contenu.length} octets)`);
    return { key, taille: contenu.length };
  }

  async obtenirUrlSignee(key: string, expiresInSeconds = EXPIRATION_DEFAUT_S): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const sig = signer(`${key}|${exp}`);
    const params = new URLSearchParams({ key, exp: String(exp), sig });
    return `/api/admin/storage?${params.toString()}`;
  }

  async supprimer(key: string): Promise<void> {
    await rm(cheminDisque(key), { force: true });
  }
}

/**
 * Valide la signature d'une URL mock et renvoie le contenu du fichier. Utilisé
 * par la route `/api/admin/storage` — jamais appelé directement par le code
 * métier.
 */
export async function lireFichierSigneMock(
  key: string,
  exp: string,
  sig: string
): Promise<{ contenu: Buffer } | { erreur: "expiree" | "signature" | "introuvable" }> {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum * 1000 < Date.now()) {
    return { erreur: "expiree" };
  }
  const attendue = Buffer.from(signer(`${key}|${exp}`));
  const recue = Buffer.from(sig);
  if (attendue.length !== recue.length || !timingSafeEqual(attendue, recue)) {
    return { erreur: "signature" };
  }
  try {
    return { contenu: await readFile(cheminDisque(key)) };
  } catch {
    return { erreur: "introuvable" };
  }
}
