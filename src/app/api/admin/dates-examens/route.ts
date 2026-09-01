import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Gestion du calendrier d'examens (§2.3, §4.2, §4.2.1). Réservé ADMIN — le
 * middleware ne couvre que les pages `/admin/*`, jamais `/api/*`, donc le
 * contrôle de rôle se fait ici (comme toutes les routes API du projet).
 *
 * Upsert sur la clé naturelle `(typeExamen, anneeScolaire)` : ajouter et
 * modifier passent par le même appel. Une date précise et une période estimée
 * sont exclusives — le mode choisi vide l'autre champ.
 */
const bodySchema = z
  .object({
    typeExamen: z.enum(["BEPC", "PROBATOIRE", "BAC"]),
    anneeScolaire: z.string().regex(/^\d{4}-\d{4}$/, "Année scolaire attendue au format AAAA-AAAA (ex. 2026-2027)."),
    mode: z.enum(["precise", "estimee"]),
    dateExamen: z.coerce.date().optional(),
    datePeriodeEstimee: z.string().trim().min(1).max(120).optional(),
  })
  .refine((d) => (d.mode === "precise" ? d.dateExamen instanceof Date : true), {
    message: "Une date précise est requise.",
    path: ["dateExamen"],
  })
  .refine((d) => (d.mode === "estimee" ? typeof d.datePeriodeEstimee === "string" : true), {
    message: "Une période estimée est requise.",
    path: ["datePeriodeEstimee"],
  });

export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }
  const { typeExamen, anneeScolaire, mode } = parsed.data;

  const champs =
    mode === "precise"
      ? { dateExamen: parsed.data.dateExamen ?? null, datePeriodeEstimee: null }
      : { dateExamen: null, datePeriodeEstimee: parsed.data.datePeriodeEstimee ?? null };

  const dateExamenRow = await prisma.dateExamen.upsert({
    where: { typeExamen_anneeScolaire: { typeExamen, anneeScolaire } },
    update: { ...champs, ajouteParAdminId: session.user.id },
    create: { typeExamen, anneeScolaire, ...champs, ajouteParAdminId: session.user.id },
  });

  return NextResponse.json({ dateExamen: dateExamenRow });
}
