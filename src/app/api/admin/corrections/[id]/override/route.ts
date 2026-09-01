import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Override manuel de la note d'une correction signalée (§2.3, §2.8). Réservé
 * ADMIN (contrôle de rôle ici — le middleware ne couvre pas `/api/*`).
 *
 * N'écrase jamais la sortie de l'IA : renseigne `noteOverride` /
 * `justificationOverride` (qui priment sur `note` à l'affichage) + trace
 * l'admin et la date de traitement du signalement. `note`, `pointsForts`,
 * `feedbackDetaille` d'origine restent intacts.
 */
const bodySchema = z.object({
  noteOverride: z.coerce.number().min(0).max(20),
  justificationOverride: z.string().trim().min(3).max(2000),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }

  const correction = await prisma.correctionDetail.findUnique({ where: { id }, select: { id: true, signalee: true } });
  if (!correction) {
    return NextResponse.json({ error: "Correction introuvable." }, { status: 404 });
  }

  const miseAJour = await prisma.correctionDetail.update({
    where: { id },
    data: {
      noteOverride: parsed.data.noteOverride,
      justificationOverride: parsed.data.justificationOverride,
      overrideParAdminId: session.user.id,
      dateTraitementSignalement: new Date(),
    },
    select: { id: true, noteOverride: true, dateTraitementSignalement: true },
  });

  return NextResponse.json({ correction: miseAJour });
}
