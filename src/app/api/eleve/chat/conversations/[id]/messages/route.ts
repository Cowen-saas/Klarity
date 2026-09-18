import { NextResponse } from "next/server";
import { z } from "zod";
import type { Filiere, NiveauClasse } from "@prisma/client";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { getAIProvider, AIRateLimitError, MODELE_HAIKU, type ChatMessage, type ContexteEpreuve } from "@/lib/ai";
import { estimerCoutIA } from "@/lib/ai/pricing";
import { resoudreVideosPourMessages } from "@/lib/video/chat-recommendation";

/**
 * Fil de messages d'une conversation chat-tuteur, mode 1 ou mode 2 (§2.1,
 * §4.4) — `conversation.epreuveId` est le seul champ qui distingue les deux
 * (CLAUDE.md). Première route de l'app touchant une ressource par ID
 * appartenant à un élève précis — vérification IDOR systématique avant
 * toute lecture/écriture (réf. sécurité §5, cf. CLAUDE.md), jamais côté UI
 * seule.
 */

/**
 * Contexte du mode 2 (§2.1.1) — jamais un appel IA supplémentaire pour le
 * construire. `corrige` réutilise le texte déjà produit par la correction
 * (`CorrectionDetail`, gratuit). `enonce` reste volontairement un résumé
 * léger (titre/matière/classe/année) plutôt que le contenu intégral du PDF
 * de l'épreuve : l'attacher en pièce jointe serait refacturé à **chaque**
 * message de la conversation (contrairement à la correction, qui n'est
 * calculée qu'une fois) — coût à maîtriser (§6.4). L'énoncé complet reste
 * téléchargeable par l'élève depuis la banque d'épreuves s'il veut le
 * relire ; à revisiter avec le cache de prompts Anthropic si l'énoncé
 * intégral s'avère nécessaire un jour.
 */
async function chargerContexteEpreuve(epreuveId: string, eleveId: string): Promise<ContexteEpreuve | null> {
  const [epreuve, correction] = await Promise.all([
    prisma.epreuve.findUnique({
      where: { id: epreuveId },
      select: { titre: true, anneeScolaire: true, classe: true, filiere: true, matiere: { select: { nom: true } } },
    }),
    prisma.correctionDetail.findUnique({ where: { epreuveId_eleveId: { epreuveId, eleveId } } }),
  ]);
  if (!epreuve || !correction) return null;

  const enonce =
    `Épreuve : "${epreuve.titre}" — ${epreuve.matiere.nom}, ${epreuve.classe}` +
    `${epreuve.filiere ? ` série ${epreuve.filiere}` : ""}, année ${epreuve.anneeScolaire}. ` +
    "(Résumé léger — l'énoncé complet est téléchargeable par l'élève depuis la banque d'épreuves.)";

  const pointsManques = correction.pointsManques as { notion: string; detail: string }[];
  const corrige =
    `Note obtenue : ${correction.note ?? "—"}/20.\n` +
    `Points forts : ${(correction.pointsForts as string[]).join("; ") || "aucun"}.\n` +
    `Points à travailler : ${pointsManques.map((pm) => `${pm.notion} — ${pm.detail}`).join(" | ") || "aucun"}.\n` +
    `Retour détaillé : ${correction.feedbackDetaille}`;

  return { enonce, corrige };
}

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
    select: { id: true, eleveId: true, matiereId: true, epreuveId: true },
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
  const garde = await exigerRole("ELEVE");
  if (!garde.ok) return garde.response;
  const session = garde.session;

  const conversation = await chargerConversationAutorisee(id, session.user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
  }

  const messages = await prisma.messageChat.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
  });
  const videoParMessageId = await resoudreVideosPourMessages(messages, session.user.id, conversation.matiereId);
  const messagesAvecVideo = messages.map((m) => ({ ...m, video: videoParMessageId.get(m.id) ?? null }));
  return NextResponse.json({ messages: messagesAvecVideo });
}

const bodySchema = z.object({ contenu: z.string().min(1).max(4000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const garde = await exigerRole("ELEVE");
  if (!garde.ok) return garde.response;
  const session = garde.session;

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

  const contexteEpreuve = conversation.epreuveId
    ? await chargerContexteEpreuve(conversation.epreuveId, session.user.id)
    : null;

  const aiProvider = getAIProvider();
  let reponse;
  try {
    reponse = await aiProvider.chat(messages, programme?.contenuStructure ?? null, contexteEpreuve ?? undefined);
  } catch (err) {
    if (err instanceof AIRateLimitError) {
      return NextResponse.json(
        { error: "Le tuteur IA est temporairement surchargé, réessaie dans un instant." },
        { status: 429 }
      );
    }
    // Panne technique du provider IA (clé invalide, réseau, Anthropic
    // indisponible) — jamais laissée remonter telle quelle : sans ce garde-fou,
    // le framework répond avec un corps non-JSON et le client affiche à tort
    // "Impossible de contacter le serveur, vérifie ta connexion" pour une
    // panne serveur, jamais un problème de réseau côté élève.
    console.error("[chat] échec technique du provider IA", err);
    return NextResponse.json(
      { error: "Le tuteur IA est momentanément indisponible. Réessaie dans quelques instants." },
      { status: 502 }
    );
  }

  const messageAssistant = await prisma.messageChat.create({
    data: {
      conversationId: id,
      role: "ASSISTANT",
      contenu: reponse.contenu,
      modeleIA: MODELE_HAIKU,
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

  const videoParMessageId = await resoudreVideosPourMessages([messageAssistant], session.user.id, conversation.matiereId);
  const messageAssistantAvecVideo = { ...messageAssistant, video: videoParMessageId.get(messageAssistant.id) ?? null };

  return NextResponse.json({ messageEleve, messageAssistant: messageAssistantAvecVideo }, { status: 201 });
}
