import { NextResponse } from "next/server";
import { z } from "zod";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { planifierQuizPourEleve } from "@/lib/queue/quiz";
import { FileAttenteIndisponibleError } from "@/lib/queue/errors";

/**
 * Quiz ciblé sur une lacune précise (§2.1, v1.11) — déclenché manuellement
 * depuis "Mes lacunes". Toujours asynchrone (§3) : enqueue puis le client
 * sonde `GET /api/eleve/quiz/[id]` une fois l'id connu (pas encore connu
 * ici — le worker crée la ligne Quiz ; ce endpoint ne renvoie qu'un accusé).
 */
const bodySchema = z.object({ lacuneId: z.string().min(1) });

/** Sondage : dernier quiz ciblé généré pour cette lacune (créé après l'enqueue du POST). */
export async function GET(request: Request) {
  const garde = await exigerRole("ELEVE");
  if (!garde.ok) return garde.response;

  const lacuneId = new URL(request.url).searchParams.get("lacuneId");
  if (!lacuneId) {
    return NextResponse.json({ error: "lacuneId requis." }, { status: 400 });
  }

  const quiz = await prisma.quiz.findFirst({
    where: { eleveId: garde.session.user.id, origine: "CIBLE", lacuneCibleId: lacuneId },
    orderBy: { dateGeneration: "desc" },
    select: { id: true },
  });
  return NextResponse.json({ quiz });
}

export async function POST(request: Request) {
  const garde = await exigerRole("ELEVE");
  if (!garde.ok) return garde.response;
  const eleveId = garde.session.user.id;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  // IDOR : la lacune doit appartenir à l'élève connecté et être active.
  const lacune = await prisma.lacune.findFirst({
    where: { id: parsed.data.lacuneId, eleveId, resolu: false },
    select: { id: true },
  });
  if (!lacune) {
    return NextResponse.json({ error: "Lacune introuvable." }, { status: 404 });
  }

  try {
    await planifierQuizPourEleve(eleveId, lacune.id);
  } catch (err) {
    if (err instanceof FileAttenteIndisponibleError) {
      console.error("[quiz/cible] file d'attente indisponible", err.cause);
      return NextResponse.json(
        { error: "Service momentanément indisponible. Réessaie dans quelques instants." },
        { status: 503 }
      );
    }
    throw err;
  }
  return NextResponse.json({ enqueued: true }, { status: 202 });
}
