import { prisma } from "@/lib/prisma";
import { resoudrePremiereVideoParNotion, type VideoVue } from "./lecture";

/**
 * Recommandation vidéo dans le chat-tuteur (§2.5, Passe 3) — décision validée
 * avec l'utilisateur avant de coder (chantier vidéo, passe 1) : le chat
 * (`chat()`) ne produit qu'un texte libre, sans notion structurée. Plutôt que
 * de forcer une sortie structurée supplémentaire (migration + réécriture du
 * prompt pour un gain marginal), on retient une **correspondance
 * déterministe, sans coût IA supplémentaire** : si la réponse de l'assistant
 * mentionne littéralement une des notions actives de l'élève dans la matière
 * en cours, la vidéo déjà en cache pour cette notion est jointe au message.
 * Recalculée à chaque lecture (GET comme POST) à partir des lacunes
 * *actuellement* actives — pas figée au moment de l'envoi — donc jamais de
 * nouvelle colonne sur `MessageChat` : une lacune résolue depuis cesse
 * simplement d'apparaître sur les anciens messages, ce qui est cohérent avec
 * un écran pensé pour dire "quoi travailler maintenant", pas un historique
 * figé.
 */

function trouverNotionMentionnee(texte: string, notions: string[]): string | null {
  const texteNormalise = texte.toLowerCase();
  // Notions les plus longues d'abord : en cas de chevauchement (une notion
  // préfixe d'une autre), privilégie la correspondance la plus spécifique.
  const parLongueurDecroissante = [...notions].sort((a, b) => b.length - a.length);
  for (const notion of parLongueurDecroissante) {
    if (texteNormalise.includes(notion.toLowerCase())) return notion;
  }
  return null;
}

/**
 * Pour chaque message ASSISTANT fourni, résout la vidéo recommandée (ou
 * `null`) selon la correspondance déterministe ci-dessus. `eleveId` +
 * `matiereId` bornent les lacunes actives interrogées — jamais toutes les
 * lacunes de l'élève, seulement celles de la matière discutée.
 */
export async function resoudreVideosPourMessages(
  messages: { id: string; role: "ELEVE" | "ASSISTANT"; contenu: string }[],
  eleveId: string,
  matiereId: string
): Promise<Map<string, VideoVue>> {
  const resultat = new Map<string, VideoVue>();

  const lacunesActives = await prisma.lacune.findMany({
    where: { eleveId, matiereId, resolu: false },
    select: { notion: true },
  });
  const notions = lacunesActives.map((l) => l.notion);
  if (notions.length === 0) return resultat;

  const notionParMessageId = new Map<string, string>();
  for (const m of messages) {
    if (m.role !== "ASSISTANT") continue;
    const notion = trouverNotionMentionnee(m.contenu, notions);
    if (notion) notionParMessageId.set(m.id, notion);
  }
  if (notionParMessageId.size === 0) return resultat;

  const videoParNotion = await resoudrePremiereVideoParNotion([...new Set(notionParMessageId.values())]);
  for (const [messageId, notion] of notionParMessageId) {
    const video = videoParNotion.get(notion);
    if (video) resultat.set(messageId, video);
  }
  return resultat;
}
