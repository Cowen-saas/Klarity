import { NextResponse } from "next/server";
import { z } from "zod";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { anonymiserEleve } from "@/lib/retention/anonymisation";

/**
 * Clôture manuelle immédiate du compte d'un enfant par le parent (§2.9.1) —
 * sans attendre le délai de grâce. Exécute exactement la même logique
 * d'anonymisation que le job automatique, mais journalise
 * `COMPTE_ANONYMISE_MANUEL` avec l'identité du parent à l'origine (§4.6).
 *
 * IDOR : réservé PARENT, et le parent doit avoir un `ParentEleveLink` vérifié
 * vers cet élève — re-vérifié ici à chaque requête, jamais fié à l'UI.
 * Double confirmation (également validée côté serveur) : case cochée + saisie
 * du mot « CLÔTURER ».
 */
const bodySchema = z.object({
  comprend: z.literal(true),
  confirmationTexte: z.string(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await exigerRole("PARENT");
  if (!garde.ok) return garde.response;
  const session = garde.session;

  const { id: eleveId } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirmation incomplète." }, { status: 400 });
  }
  if (parsed.data.confirmationTexte.trim().toUpperCase() !== "CLÔTURER") {
    return NextResponse.json({ error: 'Tape exactement « CLÔTURER » pour confirmer.' }, { status: 400 });
  }

  const lien = await prisma.parentEleveLink.findUnique({
    where: { parentId_eleveId: { parentId: session.user.id, eleveId } },
    select: { id: true },
  });
  if (!lien) {
    await prisma.auditLogSecurite.create({
      data: { typeEvenement: "IDOR_BLOCKED", utilisateurId: session.user.id, details: { tentative: "cloture", eleveId } },
    });
    return NextResponse.json({ error: "Cet élève n'est pas lié à ton compte." }, { status: 403 });
  }

  const parent = await prisma.parent.findUnique({ where: { id: session.user.id }, select: { telephone: true } });

  const resultat = await anonymiserEleve(eleveId, {
    type: "MANUEL",
    parentId: session.user.id,
    parentTelephone: parent?.telephone ?? session.user.telephone ?? "inconnu",
  });

  return NextResponse.json({
    cloture: true,
    dejaAnonymise: resultat.dejaAnonymise,
    contenuSupprime: resultat.contenuSupprime,
  });
}
