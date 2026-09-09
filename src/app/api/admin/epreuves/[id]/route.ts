import { NextResponse } from "next/server";
import { z } from "zod";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage";

/**
 * Modification / suppression d'une épreuve de la banque (§2.3, §4.2, §4.3).
 * Réservé ADMIN (contrôle de rôle ici — le middleware ne couvre pas `/api/*`) ;
 * IDOR : l'épreuve visée est systématiquement relue par `id` avant toute
 * écriture, jamais supposée exister ou appartenir au bon contexte.
 */
const TAILLE_MAX_OCTETS = 20 * 1024 * 1024;

const metaSchema = z.object({
  matiereId: z.string().min(1).optional(),
  classe: z.enum(["TROISIEME", "PREMIERE", "TERMINALE"]).optional(),
  filiere: z.enum(["A", "C", "D", "TI"]).optional(),
  titre: z.string().trim().min(3).max(200).optional(),
  anneeScolaire: z.string().regex(/^\d{4}-\d{4}$/, "Année scolaire attendue au format AAAA-AAAA.").optional(),
});

function validerFichierOptionnel(
  f: FormDataEntryValue | null,
  champ: string
): { ok: true; file: File | null } | { ok: false; error: string } {
  if (!(f instanceof File) || f.size === 0) return { ok: true, file: null };
  if (f.type !== "application/pdf") return { ok: false, error: `Le fichier "${champ}" doit être un PDF.` };
  if (f.size > TAILLE_MAX_OCTETS) return { ok: false, error: `Le fichier "${champ}" dépasse 20 Mo.` };
  return { ok: true, file: f };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await exigerRole("ADMIN");
  if (!garde.ok) return garde.response;

  const { id } = await params;
  const existante = await prisma.epreuve.findUnique({ where: { id } });
  if (!existante) {
    return NextResponse.json({ error: "Épreuve introuvable." }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });
  }

  const parsed = metaSchema.safeParse({
    matiereId: form.get("matiereId") || undefined,
    classe: form.get("classe") || undefined,
    filiere: form.get("filiere") || undefined,
    titre: form.get("titre") || undefined,
    anneeScolaire: form.get("anneeScolaire") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const classeEffective = parsed.data.classe ?? existante.classe;
  // Le formulaire envoie toujours `classe` (boutons contrôlés côté client) donc
  // la présence de `classe` dans la requête fait foi pour la filière associée —
  // sans ça une 3ème existante conserverait par erreur l'ancienne filière si elle
  // n'était pas explicitement effacée par le client.
  const filiereEffective =
    classeEffective === "TROISIEME" ? null : (parsed.data.filiere ?? existante.filiere);
  if (classeEffective !== "TROISIEME" && !filiereEffective) {
    return NextResponse.json(
      { error: "La filière est requise pour Première/Terminale, absente en 3ème." },
      { status: 400 }
    );
  }

  const fiche = validerFichierOptionnel(form.get("fichePdf"), "fiche de l'épreuve");
  if (!fiche.ok) return NextResponse.json({ error: fiche.error }, { status: 400 });
  const corrige = validerFichierOptionnel(form.get("corrigeReference"), "corrigé de référence");
  if (!corrige.ok) return NextResponse.json({ error: corrige.error }, { status: 400 });

  const matiereId = parsed.data.matiereId ?? existante.matiereId;
  if (parsed.data.matiereId) {
    const matiere = await prisma.matiere.findUnique({ where: { id: matiereId } });
    if (!matiere || !matiere.banqueDisponible) {
      return NextResponse.json({ error: "Matière inconnue ou sans banque d'épreuves." }, { status: 400 });
    }
  }

  const storage = getStorageProvider();

  // Nouveaux fichiers uploadés d'abord (on ne veut jamais perdre l'ancien objet
  // R2 si l'upload du remplaçant échoue) ; l'ancien n'est supprimé qu'une fois
  // la ligne `Epreuve` mise à jour avec succès, pour ne jamais laisser la base
  // pointer vers une clé déjà effacée du bucket.
  let nouvelleFicheKey: string | null = null;
  let nouveauCorrigeKey: string | null = null;
  try {
    if (fiche.file) {
      const up = await storage.uploader({
        dossier: "epreuves",
        nomOriginal: fiche.file.name,
        contentType: fiche.file.type,
        contenu: Buffer.from(await fiche.file.arrayBuffer()),
      });
      nouvelleFicheKey = up.key;
    }
    if (corrige.file) {
      const up = await storage.uploader({
        dossier: "corriges",
        nomOriginal: corrige.file.name,
        contentType: corrige.file.type,
        contenu: Buffer.from(await corrige.file.arrayBuffer()),
      });
      nouveauCorrigeKey = up.key;
    }
  } catch {
    return NextResponse.json({ error: "Échec de l'upload d'un fichier remplaçant." }, { status: 502 });
  }

  const epreuve = await prisma.epreuve.update({
    where: { id },
    data: {
      matiereId,
      classe: classeEffective,
      filiere: filiereEffective,
      titre: parsed.data.titre ?? existante.titre,
      anneeScolaire: parsed.data.anneeScolaire ?? existante.anneeScolaire,
      ...(nouvelleFicheKey ? { fichePdfKey: nouvelleFicheKey } : {}),
      ...(nouveauCorrigeKey ? { corrigeReferenceKey: nouveauCorrigeKey } : {}),
    },
    select: { id: true, titre: true },
  });

  // Anciens objets R2 purgés seulement après le commit DB réussi ci-dessus —
  // jamais de fichier orphelin, jamais de perte si l'update avait échoué.
  await Promise.all([
    nouvelleFicheKey ? storage.supprimer(existante.fichePdfKey) : Promise.resolve(),
    nouveauCorrigeKey ? storage.supprimer(existante.corrigeReferenceKey) : Promise.resolve(),
  ]);

  return NextResponse.json({ epreuve });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await exigerRole("ADMIN");
  if (!garde.ok) return garde.response;

  const { id } = await params;
  const existante = await prisma.epreuve.findUnique({
    where: { id },
    select: { id: true, fichePdfKey: true, corrigeReferenceKey: true },
  });
  if (!existante) {
    return NextResponse.json({ error: "Épreuve introuvable." }, { status: 404 });
  }

  // Une épreuve déjà composée ne doit jamais disparaître : ça casserait
  // l'historique de l'élève (TentativeEpreuve/CorrectionDetail) et, pour le mode
  // chat contextualisé, une conversation encore consultable (ConversationChat.epreuveId).
  const [tentatives, corrections, conversations] = await Promise.all([
    prisma.tentativeEpreuve.count({ where: { epreuveId: id } }),
    prisma.correctionDetail.count({ where: { epreuveId: id } }),
    prisma.conversationChat.count({ where: { epreuveId: id } }),
  ]);
  if (tentatives > 0 || corrections > 0 || conversations > 0) {
    return NextResponse.json(
      {
        error:
          "Impossible de supprimer : au moins un élève a déjà composé, été corrigé, ou discuté sur cette épreuve. " +
          "Retire-la plutôt de la sélection (modifie la matière/classe si besoin) pour ne plus la proposer aux nouveaux élèves.",
      },
      { status: 409 }
    );
  }

  await prisma.epreuve.delete({ where: { id } });

  const storage = getStorageProvider();
  await Promise.all([storage.supprimer(existante.fichePdfKey), storage.supprimer(existante.corrigeReferenceKey)]);

  return NextResponse.json({ supprime: true });
}
