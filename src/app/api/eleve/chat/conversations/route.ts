import { NextResponse } from "next/server";
import { z } from "zod";
import type { Filiere, NiveauClasse } from "@prisma/client";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { resoudreVideosPourMessages } from "@/lib/video/chat-recommendation";

/**
 * Chat-tuteur (§2.1, §4.4) : trouve ou crée la conversation.
 *
 * Mode 1 (général) : `matiereId` fourni, `epreuveId` NULL.
 * Mode 2 (contextualisé à une épreuve, §2.1.1) : `epreuveId` fourni —
 * `matiereId` n'est alors jamais accepté du client, il est résolu côté
 * serveur depuis l'épreuve elle-même. Accessible uniquement depuis l'écran
 * de résultat d'une correction déjà produite : sans `CorrectionDetail`
 * existante, il n'y a rien à discuter — 404, jamais un mode 2 sur une
 * épreuve non encore corrigée. `epreuveId` est le seul champ qui distingue
 * les deux modes (CLAUDE.md) ; jamais de bascule implicite entre les deux.
 */
const bodySchema = z.object({ matiereId: z.string().min(1).optional(), epreuveId: z.string().min(1).optional() });

/** Annote l'historique déjà existant d'une conversation rouverte (§2.5, Passe 3) — même correspondance déterministe que la route messages. */
async function avecVideos<T extends { id: string; matiereId: string; eleveId: string; messages: { id: string; role: "ELEVE" | "ASSISTANT"; contenu: string }[] }>(
  conversation: T
): Promise<T> {
  const videoParMessageId = await resoudreVideosPourMessages(conversation.messages, conversation.eleveId, conversation.matiereId);
  return { ...conversation, messages: conversation.messages.map((m) => ({ ...m, video: videoParMessageId.get(m.id) ?? null })) };
}

export async function POST(request: Request) {
  const garde = await exigerRole("ELEVE");
  if (!garde.ok) return garde.response;
  const session = garde.session;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.matiereId && !parsed.data.epreuveId)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const eleveId = session.user.id;
  const classe = session.user.classe as NiveauClasse;
  const filiere = (session.user.filiere ?? null) as Filiere | null;

  if (parsed.data.epreuveId) {
    const epreuveId = parsed.data.epreuveId;
    const epreuve = await prisma.epreuve.findFirst({ where: { id: epreuveId, classe, filiere }, select: { id: true, matiereId: true } });
    const correction = epreuve
      ? await prisma.correctionDetail.findUnique({ where: { epreuveId_eleveId: { epreuveId, eleveId } }, select: { id: true } })
      : null;
    if (!epreuve || !correction) {
      return NextResponse.json({ error: "Épreuve introuvable ou pas encore corrigée." }, { status: 404 });
    }

    let conversation = await prisma.conversationChat.findFirst({
      where: { eleveId, epreuveId },
      orderBy: { createdAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) {
      conversation = await prisma.conversationChat.create({
        data: { eleveId, matiereId: epreuve.matiereId, epreuveId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    }
    return NextResponse.json({ conversation: await avecVideos(conversation) });
  }

  const matiereId = parsed.data.matiereId!;
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

  return NextResponse.json({ conversation: await avecVideos(conversation) });
}
