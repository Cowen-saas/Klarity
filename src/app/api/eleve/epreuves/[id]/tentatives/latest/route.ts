import { NextResponse } from "next/server";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

/**
 * Statut de la dernière tentative de l'élève sur cette épreuve — sondé par
 * l'écran d'upload (maquette 07, panneau "Analyse de ta copie...") pendant le
 * traitement asynchrone. IDOR : filtré par `eleveId` de la session, jamais un
 * id de tentative passé en clair par le client.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await exigerRole("ELEVE");
  if (!garde.ok) return garde.response;

  const { id: epreuveId } = await params;
  const tentative = await prisma.tentativeEpreuve.findFirst({
    where: { eleveId: garde.session.user.id, epreuveId },
    orderBy: { dateSoumission: "desc" },
    select: { id: true, numeroTentative: true, statut: true, messageErreur: true },
  });

  return NextResponse.json({ tentative });
}
