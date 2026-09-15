import { NextResponse } from "next/server";
import { z } from "zod";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

/**
 * Signalement d'une correction par l'élève (§2.8, maquette 08 — modale
 * "Signaler cette correction"). Alimente la file de revue admin
 * (`/admin/corrections-signalees`, `CorrectionDetail.signalee`).
 *
 * IDOR : la correction doit appartenir à l'élève connecté — relue par id
 * avant toute écriture, jamais supposée (réf. sécurité §5, cf. CLAUDE.md).
 */
const bodySchema = z.object({
  motif: z.enum(["LECTURE_ILLISIBLE", "BAREME_INCORRECT", "AUTRE"]),
  commentaire: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await exigerRole("ELEVE");
  if (!garde.ok) return garde.response;

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const correction = await prisma.correctionDetail.findUnique({ where: { id }, select: { id: true, eleveId: true } });
  if (correction && correction.eleveId !== garde.session.user.id) {
    await prisma.auditLogSecurite.create({
      data: { typeEvenement: "IDOR_BLOCKED", utilisateurId: garde.session.user.id, details: { correctionId: id } },
    });
  }
  if (!correction || correction.eleveId !== garde.session.user.id) {
    return NextResponse.json({ error: "Correction introuvable." }, { status: 404 });
  }

  await prisma.correctionDetail.update({
    where: { id },
    data: {
      signalee: true,
      motifSignalement: parsed.data.motif,
      commentaireEleve: parsed.data.commentaire || null,
      dateSignalement: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
