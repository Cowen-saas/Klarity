import { NextResponse } from "next/server";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { planifierQuizPourEleve } from "@/lib/queue/quiz";

/**
 * Quiz journalier de l'élève connecté (§2.1, §4.3). GET renvoie l'état
 * actuel (quiz déjà généré aujourd'hui, ou éligibilité à en générer un) ;
 * POST enqueue la génération à la demande — jamais d'appel IA inline (§3),
 * le worker traite le job et le client sonde via GET.
 */
function debutAujourdhui(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const garde = await exigerRole("ELEVE");
  if (!garde.ok) return garde.response;
  const eleveId = garde.session.user.id;

  const [quiz, nbLacunesActives] = await Promise.all([
    prisma.quiz.findFirst({
      where: { eleveId, origine: "JOURNALIER", dateGeneration: { gte: debutAujourdhui() } },
      select: { id: true, statut: true, score: true },
    }),
    prisma.lacune.count({ where: { eleveId, resolu: false } }),
  ]);

  return NextResponse.json({ quiz, peutGenerer: !quiz && nbLacunesActives > 0 });
}

export async function POST() {
  const garde = await exigerRole("ELEVE");
  if (!garde.ok) return garde.response;
  const eleveId = garde.session.user.id;

  const existant = await prisma.quiz.findFirst({
    where: { eleveId, origine: "JOURNALIER", dateGeneration: { gte: debutAujourdhui() } },
    select: { id: true },
  });
  if (existant) {
    return NextResponse.json({ quiz: existant });
  }

  const nbLacunesActives = await prisma.lacune.count({ where: { eleveId, resolu: false } });
  if (nbLacunesActives === 0) {
    return NextResponse.json({ error: "Aucune lacune active — pas de quiz à générer pour l'instant." }, { status: 400 });
  }

  await planifierQuizPourEleve(eleveId);
  return NextResponse.json({ enqueued: true }, { status: 202 });
}
