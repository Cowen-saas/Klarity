import { NextResponse } from "next/server";
import type { Filiere, NiveauClasse } from "@prisma/client";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { getStorageProvider, StorageError } from "@/lib/storage";
import { planifierCorrection } from "@/lib/queue/correction";
import { FileAttenteIndisponibleError } from "@/lib/queue/errors";

/**
 * Upload d'une tentative de copie photographiée (§2.1, §4.3). Répond
 * immédiatement (§3, jamais d'appel IA synchrone ici) : la tentative qui
 * déclenche un traitement réel enqueue le job de correction (worker) ; les
 * suivantes sont de la pratique gratuite, enregistrées mais jamais
 * retraitées (§2.1, §6.4) — la correction affichée reste celle produite une
 * seule fois.
 *
 * Déclenchement du traitement : basé sur l'**absence** de `CorrectionDetail`
 * et d'une tentative déjà en attente/en traitement — pas littéralement
 * `numeroTentative === 1`. Une 1ère tentative en échec technique (429,
 * erreur réseau) ne produit aucune `CorrectionDetail` : bloquer tout
 * traitement futur sur le seul numéro de tentative laisserait l'élève sans
 * jamais pouvoir être noté sur cette épreuve après un simple incident
 * transitoire, ce qui n'est pas l'intention de la règle "une seule
 * correction par tentative" (protéger le coût, jamais re-corriger une copie
 * déjà notée — la contrainte `@@unique([epreuveId, eleveId])` sur
 * `CorrectionDetail` reste le garde-fou définitif).
 *
 * IDOR (réf. sécurité §5) : l'épreuve doit exister et appartenir à la
 * classe/filière de l'élève connecté (même filtrage que la banque
 * d'épreuves, `src/app/eleve/epreuves/page.tsx`) — jamais une épreuve
 * arbitraire par id.
 */
const TAILLE_MAX_OCTETS = 10 * 1024 * 1024;
const PAGES_MAX = 10;
const TYPES_IMAGE_ACCEPTES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await exigerRole("ELEVE");
  if (!garde.ok) return garde.response;
  const session = garde.session;

  const { id: epreuveId } = await params;
  const classe = session.user.classe as NiveauClasse;
  const filiere = (session.user.filiere ?? null) as Filiere | null;

  const epreuve = await prisma.epreuve.findFirst({
    where: { id: epreuveId, classe, filiere },
    select: { id: true },
  });
  if (!epreuve) {
    // "introuvable" recouvre aussi le cas d'une épreuve existante mais hors classe/filière —
    // jamais distingué côté réponse (même logique IDOR que le reste de l'app).
    return NextResponse.json({ error: "Épreuve introuvable." }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });
  }

  const photos = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length === 0) {
    return NextResponse.json({ error: "Au moins une page photographiée est requise." }, { status: 400 });
  }
  if (photos.length > PAGES_MAX) {
    return NextResponse.json({ error: `Maximum ${PAGES_MAX} pages par copie.` }, { status: 400 });
  }
  for (const f of photos) {
    if (!TYPES_IMAGE_ACCEPTES.has(f.type)) {
      return NextResponse.json({ error: `Format non supporté : "${f.type}" (jpeg, png ou webp attendu).` }, { status: 400 });
    }
    if (f.size > TAILLE_MAX_OCTETS) {
      return NextResponse.json({ error: "Une page dépasse 10 Mo." }, { status: 400 });
    }
  }

  const eleveId = session.user.id;
  const [nbTentatives, dejaCorrigee, tentativeEnCours] = await Promise.all([
    prisma.tentativeEpreuve.count({ where: { eleveId, epreuveId } }),
    prisma.correctionDetail.findUnique({ where: { epreuveId_eleveId: { epreuveId, eleveId } }, select: { id: true } }),
    prisma.tentativeEpreuve.findFirst({
      where: { eleveId, epreuveId, statut: { in: ["EN_ATTENTE", "EN_TRAITEMENT"] } },
      select: { id: true },
    }),
  ]);
  const numeroTentative = nbTentatives + 1;
  const doitTraiter = !dejaCorrigee && !tentativeEnCours;

  const storage = getStorageProvider();
  const photoUploadKeys: string[] = [];
  try {
    for (const f of photos) {
      const up = await storage.uploader({
        dossier: "copies",
        nomOriginal: f.name,
        contentType: f.type,
        contenu: Buffer.from(await f.arrayBuffer()),
      });
      photoUploadKeys.push(up.key);
    }
  } catch (err) {
    if (err instanceof StorageError) {
      console.error("[tentatives] stockage indisponible", err);
      return NextResponse.json(
        { error: "Service momentanément indisponible. Réessaie dans quelques instants." },
        { status: 503 }
      );
    }
    throw err;
  }

  const tentative = await prisma.tentativeEpreuve.create({
    data: {
      eleveId,
      epreuveId,
      numeroTentative,
      photoUploadKeys,
      statut: doitTraiter ? "EN_ATTENTE" : "TERMINE",
    },
    select: { id: true, numeroTentative: true, statut: true },
  });

  if (doitTraiter) {
    try {
      await planifierCorrection(tentative.id);
    } catch (err) {
      if (err instanceof FileAttenteIndisponibleError) {
        console.error("[tentatives] file d'attente indisponible", err.cause);
        // La tentative n'a jamais été réellement mise en file — la laisser en
        // EN_ATTENTE la coincerait indéfiniment sans job pour la traiter.
        // On l'annule plutôt que de mentir sur son statut, pour que l'élève
        // puisse réessayer le même envoi une fois le service rétabli.
        await prisma.tentativeEpreuve.delete({ where: { id: tentative.id } }).catch(() => {});
        return NextResponse.json(
          { error: "Service momentanément indisponible. Réessaie dans quelques instants." },
          { status: 503 }
        );
      }
      throw err;
    }
  }

  return NextResponse.json({ tentative }, { status: 201 });
}
