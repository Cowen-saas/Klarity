import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage";
import { ANNEE_ARCHIVAGE_RECUL, anneeScolaireDebutCourante } from "./config";

/**
 * Archivage annuel des photos de copies (§2.9.3) — pensé pour tourner une fois
 * par an sur le worker. Supprime du stockage les `photoUploadKeys` des
 * `TentativeEpreuve` rattachées à une `Epreuve` dont l'année scolaire est
 * antérieure à « année scolaire en cours − ANNEE_ARCHIVAGE_RECUL ».
 *
 * `CorrectionDetail` (note + feedback) est **conservé** : seules les images
 * brutes partent. La ligne `TentativeEpreuve` reste, `photoUploadKeys` est
 * vidé — ce qui rend le job idempotent (un second passage ne retrouve plus de
 * clé à supprimer).
 */

export interface ResultatArchivagePhotos {
  anneeScolairePivot: string;
  tentativesArchivees: number;
  photosSupprimees: number;
}

export async function archiverPhotosAncienneAnnee(maintenant: Date = new Date()): Promise<ResultatArchivagePhotos> {
  const anneePivotDebut = anneeScolaireDebutCourante(maintenant) - ANNEE_ARCHIVAGE_RECUL;
  const anneeScolairePivot = `${anneePivotDebut}-${anneePivotDebut + 1}`;

  // Année scolaire strictement antérieure à la pivot : on compare l'année de
  // début (préfixe "AAAA-"). Format garanti "AAAA-AAAA" par la route d'ajout.
  const tentatives = await prisma.tentativeEpreuve.findMany({
    where: { epreuve: { anneeScolaire: { lt: anneeScolairePivot } } },
    select: { id: true, photoUploadKeys: true },
  });

  const storage = getStorageProvider();
  let photosSupprimees = 0;
  let tentativesArchivees = 0;

  for (const t of tentatives) {
    const cles = Array.isArray(t.photoUploadKeys) ? (t.photoUploadKeys as unknown[]) : [];
    if (cles.length === 0) continue;
    let quelqueChoseASupprime = false;
    for (const cle of cles) {
      if (typeof cle !== "string") continue;
      try {
        await storage.supprimer(cle);
        photosSupprimees += 1;
        quelqueChoseASupprime = true;
      } catch {
        // Fichier déjà absent : on vide quand même la référence en base.
        quelqueChoseASupprime = true;
      }
    }
    await prisma.tentativeEpreuve.update({ where: { id: t.id }, data: { photoUploadKeys: [] } });
    if (quelqueChoseASupprime) tentativesArchivees += 1;
  }

  return { anneeScolairePivot, tentativesArchivees, photosSupprimees };
}
