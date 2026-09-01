import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage";

/**
 * Ajout d'une épreuve à la banque (§2.3, §4.2, §4.3). Réservé ADMIN (contrôle
 * de rôle ici — le middleware ne couvre pas `/api/*`).
 *
 * Reçoit un `multipart/form-data` : métadonnées + fiche PDF + corrigé de
 * référence. Les deux fichiers passent par `StorageProvider` (mock disque tant
 * que Cloudflare R2 n'est pas configuré) ; seules les clés opaques renvoyées
 * sont stockées en base, jamais d'URL.
 */
const TAILLE_MAX_OCTETS = 20 * 1024 * 1024;

const metaSchema = z
  .object({
    matiereId: z.string().min(1),
    classe: z.enum(["TROISIEME", "PREMIERE", "TERMINALE"]),
    filiere: z.enum(["A", "C", "D", "TI"]).optional(),
    titre: z.string().trim().min(3).max(200),
    anneeScolaire: z.string().regex(/^\d{4}-\d{4}$/, "Année scolaire attendue au format AAAA-AAAA."),
  })
  .refine((d) => (d.classe === "TROISIEME" ? d.filiere === undefined : d.filiere !== undefined), {
    message: "La filière est requise pour Première/Terminale, absente en 3ème.",
    path: ["filiere"],
  });

function validerFichier(f: FormDataEntryValue | null, champ: string): { ok: true; file: File } | { ok: false; error: string } {
  if (!(f instanceof File) || f.size === 0) return { ok: false, error: `Fichier "${champ}" manquant.` };
  if (f.type !== "application/pdf") return { ok: false, error: `Le fichier "${champ}" doit être un PDF.` };
  if (f.size > TAILLE_MAX_OCTETS) return { ok: false, error: `Le fichier "${champ}" dépasse 20 Mo.` };
  return { ok: true, file: f };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });
  }

  const parsed = metaSchema.safeParse({
    matiereId: form.get("matiereId"),
    classe: form.get("classe"),
    filiere: form.get("filiere") || undefined,
    titre: form.get("titre"),
    anneeScolaire: form.get("anneeScolaire"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const fiche = validerFichier(form.get("fichePdf"), "fiche de l'épreuve");
  if (!fiche.ok) return NextResponse.json({ error: fiche.error }, { status: 400 });
  const corrige = validerFichier(form.get("corrigeReference"), "corrigé de référence");
  if (!corrige.ok) return NextResponse.json({ error: corrige.error }, { status: 400 });

  const matiere = await prisma.matiere.findUnique({ where: { id: parsed.data.matiereId } });
  if (!matiere || !matiere.banqueDisponible) {
    return NextResponse.json({ error: "Matière inconnue ou sans banque d'épreuves." }, { status: 400 });
  }

  const storage = getStorageProvider();
  const [ficheUp, corrigeUp] = await Promise.all([
    storage.uploader({
      dossier: "epreuves",
      nomOriginal: fiche.file.name,
      contentType: fiche.file.type,
      contenu: Buffer.from(await fiche.file.arrayBuffer()),
    }),
    storage.uploader({
      dossier: "corriges",
      nomOriginal: corrige.file.name,
      contentType: corrige.file.type,
      contenu: Buffer.from(await corrige.file.arrayBuffer()),
    }),
  ]);

  const epreuve = await prisma.epreuve.create({
    data: {
      matiereId: parsed.data.matiereId,
      classe: parsed.data.classe,
      filiere: parsed.data.filiere ?? null,
      titre: parsed.data.titre,
      anneeScolaire: parsed.data.anneeScolaire,
      fichePdfKey: ficheUp.key,
      corrigeReferenceKey: corrigeUp.key,
      ajouteParAdminId: session.user.id,
    },
    select: { id: true, titre: true },
  });

  return NextResponse.json({ epreuve }, { status: 201 });
}
