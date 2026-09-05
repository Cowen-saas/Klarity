import { NextResponse } from "next/server";
import { z } from "zod";
import type { Filiere, NiveauClasse } from "@prisma/client";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

/**
 * Chat-tuteur mode 1 (§2.1, §4.4) : trouve ou crée la conversation
 * (eleveId, matiereId, epreuveId=NULL) pour la matière choisie.
 */
const bodySchema = z.object({ matiereId: z.string().min(1) });

export async function POST(request: Request) {
  const garde = await exigerRole("ELEVE");
  if (!garde.ok) return garde.response;
  const session = garde.session;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const { matiereId } = parsed.data;
  const eleveId = session.user.id;
  const classe = session.user.classe as NiveauClasse;
  const filiere = (session.user.filiere ?? null) as Filiere | null;

  const eligible = await prisma.programmeOfficiel.findFirst({
    where: { matiereId, classe, OR: [{ filiere }, { filiere: null }] },
    select: { id: true },
  });
  if (!eligible) {
    return NextResponse.json({ error: "Cette matière n'est pas disponible pour ta classe." }, { status: 403 });
  }

  let conversation = await prisma.conversationChat.findFirst({
    where: { eleveId, matiereId, epreuveId: null },
    orderBy: { createdAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!conversation) {
    conversation = await prisma.conversationChat.create({
      data: { eleveId, matiereId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  }

  return NextResponse.json({ conversation });
}
