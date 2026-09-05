import { NextResponse } from "next/server";
import { z } from "zod";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

/** Préférences de notification parent (§2.2.3) — un seul jeu de préférences par parent. */
const bodySchema = z.object({
  canal: z.enum(["SMS", "WHATSAPP"]),
  frequence: z.enum(["HEBDOMADAIRE", "MENSUEL", "CRITIQUE_UNIQUEMENT"]),
});

export async function POST(request: Request) {
  const garde = await exigerRole("PARENT");
  if (!garde.ok) return garde.response;
  const session = garde.session;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const preference = await prisma.notificationPreference.upsert({
    where: { parentId: session.user.id },
    update: parsed.data,
    create: { parentId: session.user.id, ...parsed.data },
  });

  return NextResponse.json({ preference });
}
