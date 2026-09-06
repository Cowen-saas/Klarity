import { NextResponse } from "next/server";
import { z } from "zod";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

/**
 * Création d'une fenêtre tarifaire promotionnelle (§2.4.1). Réservé ADMIN
 * (contrôle de rôle ici — le middleware ne couvre pas `/api/*`).
 *
 * `dateDebut` est calé à minuit, `dateFin` à 23:59:59.999 du jour choisi — la
 * promo couvre donc les journées entières saisies, bornes comprises.
 */
const bodySchema = z
  .object({
    nom: z.string().trim().min(2).max(120),
    dateDebut: z.string().min(1),
    dateFin: z.string().min(1),
    prix: z.coerce.number().positive().max(1_000_000),
    actif: z.boolean().optional().default(true),
  })
  .refine((v) => !Number.isNaN(Date.parse(v.dateDebut)) && !Number.isNaN(Date.parse(v.dateFin)), {
    message: "Dates invalides.",
  })
  .refine((v) => new Date(v.dateFin) > new Date(v.dateDebut), {
    message: "La date de fin doit être postérieure à la date de début.",
    path: ["dateFin"],
  });

/**
 * Bornes UTC du jour `YYYY-MM-DD` : début à 00:00:00.000Z, fin à 23:59:59.999Z.
 * En UTC (pas dans le fuseau du serveur) pour que l'affichage soit stable et
 * que « du 1er au 30 septembre » couvre bien les journées entières saisies.
 */
function bornesJour(s: string): { debut: Date; fin: Date } {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) throw new Error("date invalide");
  return {
    debut: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)),
    fin: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
  };
}

export async function POST(request: Request) {
  const garde = await exigerRole("ADMIN");
  if (!garde.ok) return garde.response;
  const session = garde.session;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }
  const data = parsed.data;

  const admin = await prisma.admin.findUnique({ where: { id: session.user.id }, select: { id: true } });
  if (!admin) {
    return NextResponse.json({ error: "Compte admin introuvable." }, { status: 400 });
  }

  let debut: Date;
  let fin: Date;
  try {
    debut = bornesJour(data.dateDebut).debut;
    fin = bornesJour(data.dateFin).fin;
  } catch {
    return NextResponse.json({ error: "Dates invalides." }, { status: 400 });
  }
  if (fin <= debut) {
    return NextResponse.json({ error: "La date de fin doit être postérieure à la date de début." }, { status: 400 });
  }

  const periode = await prisma.periodeTarifaire.create({
    data: {
      nom: data.nom,
      dateDebut: debut,
      dateFin: fin,
      prixApplique: data.prix,
      actif: data.actif,
      ajouteParAdminId: admin.id,
    },
    select: { id: true, nom: true },
  });

  return NextResponse.json({ periode }, { status: 201 });
}
