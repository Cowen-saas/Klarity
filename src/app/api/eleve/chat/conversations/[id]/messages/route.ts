import { NextResponse } from "next/server";
import { z } from "zod";
import type { Filiere, NiveauClasse } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider, AIRateLimitError, type ChatMessage } from "@/lib/ai";
import { estimerCoutIA } from "@/lib/ai/pricing";

/**
 * Fil de messages d'une conversation chat-tuteur mode 1 (§2.1, §4.4).
 * Première route de l'app touchant une ressource par ID appartenant à un
 * élève précis — vérification IDOR systématique avant toute lecture/écriture
 * (réf. sécurité §5, cf. CLAUDE.md), jamais côté UI seule.
 */

function estCaractereDeControle(code: number): boolean {
  return code < 32 && code !== 9 && code !== 10 && code !== 13;
}

function sanitizerContenu(input: string): string {
  // Retire les caracteres de controle C0 (hors tab/LF/CR), ref. securite sec.6.
  let net = "";
  for (const ch of input) {
    if (!estCaractereDeControle(ch.codePointAt(0) ?? 0)) net += ch;
  }
  return net.trim().slice(0, 4000);
}

async function chargerConversationAutorisee(id: string, eleveId: string) {
  const conversation = await prisma.conversationChat.findUnique({
    where: { id },
    select: { id: true, eleveId: true, matiereId: true },
  });
  if (conversation && conversation.eleveId !== eleveId) {
    // Tentative réelle d'accès à la ressource d'un autre élève (pas un simple ID inexistant) —
    // journalisé pour l'observabilité sécurité admin (§8 dashboard admin).
    await prisma.auditLogSecurite.create({
      data: { typeEvenement: "IDOR_BLOCKED", utilisateurId: eleveId, details: { conversationId: id } },
    });
  }
  // "introuvable" recouvre volontairement le cas "existe mais appartient à un autre élève".
  if (!conversation || conversation.eleveId !== eleveId) return null;
  return conversation;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.error || session.user.role !== "ELEVE") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const conversation = await chargerConversationAutorisee(id, session.user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
  }

  const messages = await prisma.messageChat.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ messages });
}

const bodySchema = z.object({ contenu: z.string().min(1).max(4000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.error || session.user.role !== "ELEVE") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Message invalide." }, { status: 400 });
  }

  const conversation = await chargerConversationAutorisee(id, session.user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
  }

  const contenu = sanitizerContenu(parsed.data.contenu);
  if (!contenu) {
    return NextResponse.json({ error: "Message invalide." }, { status: 400 });
  }

  const classe = session.user.classe as NiveauClasse;
  const filiere = (session.user.filiere ?? null) as Filiere | null;
  const programme = await prisma.programmeOfficiel.findFirst({
    where: { matiereId: conversation.matiereId, classe, OR: [{ filiere }, { filiere: null }] },
    select: { contenuStructure: true },
  });

  const messageEleve = await prisma.messageChat.create({
    data: { conversationId: id, role: "ELEVE", contenu },
  });

  const historique = await prisma.messageChat.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    select: { role: true, contenu: true },
  });
  const messages: ChatMessage[] = historique.map((m) => ({ role: m.role, contenu: m.contenu }));

  const aiProvider = getAIProvider();
  let reponse;
  try {
    reponse = await aiProvider.chat(messages, programme?.contenuStructure ?? null);
  } catch (err) {
    if (err instanceof AIRateLimitError) {
      return NextResponse.json(
        { error: "Le tuteur IA est temporairement surchargé, réessaie dans un instant." },
        { status: 429 }
      );
    }
    throw err;
  }

  const messageAssistant = await prisma.messageChat.create({
    data: {
      conversationId: id,
      role: "ASSISTANT",
      contenu: reponse.contenu,
      modeleIA: "claude-haiku-4-5",
      tokensInput: reponse.tokensInput,
      tokensOutput: reponse.tokensOutput,
    },
  });

  await prisma.usageIA.create({
    data: {
      eleveId: session.user.id,
      matiereId: conversation.matiereId,
      typeUsage: "CHAT",
      modele: "HAIKU",
      tokensInput: reponse.tokensInput,
      tokensOutput: reponse.tokensOutput,
      coutEstime: estimerCoutIA("HAIKU", reponse.tokensInput, reponse.tokensOutput),
    },
  });

  return NextResponse.json({ messageEleve, messageAssistant }, { status: 201 });
}
