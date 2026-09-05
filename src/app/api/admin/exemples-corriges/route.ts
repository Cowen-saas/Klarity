import { NextResponse } from "next/server";
import { z } from "zod";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

const TYPES_EXERCICE = [
  "DISSERTATION_PHILO",
  "DISSERTATION_LITTERAIRE",
  "CONTRACTION_TEXTE",
  "DISCUSSION",
  "COMMENTAIRE_COMPOSE",
  "EXPRESSION_ECRITE",
  "CORRECTION_ORTHOGRAPHIQUE",
] as const;

/**
 * Ajout d'un exemple de correction few-shot (§4.2.2). Réservé ADMIN (contrôle de
 * rôle ici — le middleware ne couvre pas `/api/*`). Ces lignes alimentent le
 * dispositif RAG / few-shot de `corrigerCopie()` : elles sont résolues par
 * `matiereId` + `typeExercice`.
 *
 * `baremeStructure` est du JSON libre (structure propre à chaque type de barème,
 * cf. `docs/baremes/`) — on valide seulement que c'est du JSON objet bien formé.
 */
const bodySchema = z.object({
  matiereId: z.string().min(1),
  typeExercice: z.enum(TYPES_EXERCICE),
  enonceModele: z.string().trim().min(10).max(20000),
  baremeStructure: z.string().trim().min(2).max(20000),
  exempleReponseModele: z.string().trim().min(10).max(60000),
  notesMethodologiques: z.string().trim().min(10).max(20000),
  langue: z.enum(["FR", "EN"]).default("FR"),
});

export async function POST(request: Request) {
  const garde = await exigerRole("ADMIN");
  if (!garde.ok) return garde.response;
  const session = garde.session;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }
  const data = parsed.data;

  let bareme: unknown;
  try {
    bareme = JSON.parse(data.baremeStructure);
  } catch {
    return NextResponse.json({ error: "Le barème n'est pas du JSON valide." }, { status: 400 });
  }
  if (bareme === null || typeof bareme !== "object" || Array.isArray(bareme)) {
    return NextResponse.json({ error: "Le barème doit être un objet JSON." }, { status: 400 });
  }

  const matiere = await prisma.matiere.findUnique({ where: { id: data.matiereId }, select: { id: true, nom: true } });
  if (!matiere) {
    return NextResponse.json({ error: "Matière introuvable." }, { status: 400 });
  }

  const admin = await prisma.admin.findUnique({ where: { id: session.user.id }, select: { id: true } });
  if (!admin) {
    return NextResponse.json({ error: "Compte admin introuvable." }, { status: 400 });
  }

  const exemple = await prisma.exempleCorrection.create({
    data: {
      matiereId: matiere.id,
      typeExercice: data.typeExercice,
      enonceModele: data.enonceModele,
      baremeStructure: bareme as object,
      exempleReponseModele: data.exempleReponseModele,
      notesMethodologiques: data.notesMethodologiques,
      langue: data.langue,
      ajouteParAdminId: admin.id,
    },
    select: { id: true, typeExercice: true, matiere: { select: { nom: true } } },
  });

  return NextResponse.json({ exemple });
}
