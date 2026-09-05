import { NextResponse } from "next/server";
import { z } from "zod";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

/** Persiste le "dernier enfant consulté" (§2.2.1) — IDOR : le lien doit exister. */
const bodySchema = z.object({ eleveId: z.string().min(1) });

export async function POST(request: Request) {
  const garde = await exigerRole("PARENT");
  if (!garde.ok) return garde.response;
  const session = garde.session;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const { eleveId } = parsed.data;

  const lien = await prisma.parentEleveLink.findUnique({
    where: { parentId_eleveId: { parentId: session.user.id, eleveId } },
    select: { id: true },
  });
  if (!lien) {
    return NextResponse.json({ error: "Cet élève n'est pas lié à ton compte." }, { status: 403 });
  }

  await prisma.parent.update({ where: { id: session.user.id }, data: { dernierEleveConsulteId: eleveId } });
  return NextResponse.json({ success: true });
}
