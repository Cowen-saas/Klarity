import type { FichierAUploader, ResultatUpload } from "./types";

/**
 * Interface StorageProvider (cahier des charges §3, §4.2, §4.3) — stockage des
 * fiches d'épreuves, corrigés de référence et (à terme) copies photographiées
 * des élèves. Sélection au démarrage via `STORAGE_MODE = mock | r2` (cf.
 * `src/lib/storage/index.ts`).
 *
 * `MockStorageProvider` écrit sur le disque local en dev ; `R2StorageProvider`
 * (Cloudflare R2, clés pas encore obtenues) arrivera plus tard — même interface,
 * les appelants (routes admin, futur pipeline de correction) ne changent pas.
 */
export interface StorageProvider {
  /** Dépose un fichier et renvoie sa clé opaque, à stocker en base. */
  uploader(fichier: FichierAUploader): Promise<ResultatUpload>;

  /**
   * URL de lecture **temporaire et signée** pour une clé donnée — jamais un
   * accès public permanent (réf. sécurité, CLAUDE.md). `expiresInSeconds` borne
   * la validité.
   */
  obtenirUrlSignee(key: string, expiresInSeconds?: number): Promise<string>;

  /** Supprime le fichier d'une clé (idempotent : ne lève pas si déjà absent). */
  supprimer(key: string): Promise<void>;
}
