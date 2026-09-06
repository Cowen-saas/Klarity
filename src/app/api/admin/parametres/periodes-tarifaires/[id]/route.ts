import { NextResponse } from "next/server";
import { z } from "zod";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

/**
 * Modification / activation-désactivation / suppression d'une fenêtre tarifaire
 * (§2.4.1). Réservé ADMIN (contrôle de rôle ici — le middleware ne couvre pas
 * `/api/*`). Tous les champs de `PATCH` sont optionnels : le même endpoint sert
 * à l'édition complète du formulaire et au simple basculement de `actif`.
 */
const patchSchema = z.object({
  nom: z.string().trim().min(2).max(120).optional(),
  dateDebut: z.string().min(1).optional(),
  dateFin: z.string().min(1).optional(),
  prix: z.coerce.number().positive().max(1_000_000).optional(),
  actif: z.boolean().optional(),
});

/** Bornes UTC du jour `YYYY-MM-DD` (cf. route POST). */
function bornesJour(s: string): { debut: Date; fin: Date } {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) throw new Error("date invalide");
  return {
    debut: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)),
    fin: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
  };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await exigerRole("ADMIN");
  if (!garde.ok) return garde.response;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }

  const existante = await prisma.periodeTarifaire.findUnique({ where: { id } });
  if (!existante) {
    return NextResponse.json({ error: "Fenêtre tarifaire introuvable." }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.nom !== undefined) data.nom = parsed.data.nom;
  if (parsed.data.prix !== undefined) data.prixApplique = parsed.data.prix;
  if (parsed.data.actif !== undefined) data.actif = parsed.data.actif;

  let debut = existante.dateDebut;
  let fin = existante.dateFin;
  try {
    if (parsed.data.dateDebut !== undefined) {
      debut = bornesJour(parsed.data.dateDebut).debut;
      data.dateDebut = debut;
    }
    if (parsed.data.dateFin !== undefined) {
      fin = bornesJour(parsed.data.dateFin).fin;
      data.dateFin = fin;
    }
  } catch {
    return NextResponse.json({ error: "Dates invalides." }, { status: 400 });
  }

  if (fin <= debut) {
    return NextResponse.json(
      { error: "La date de fin doit être postérieure à la date de début." },
      { status: 400 },
    );
  }

  const periode = await prisma.periodeTarifaire.update({
    where: { id },
    data,
    select: { id: true, nom: true, actif: true },
  });

  return NextResponse.json({ periode });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await exigerRole("ADMIN");
  if (!garde.ok) return garde.response;

  const { id } = await params;
  const existante = await prisma.periodeTarifaire.findUnique({ where: { id }, select: { id: true } });
  if (!existante) {
    return NextResponse.json({ error: "Fenêtre tarifaire introuvable." }, { status: 404 });
  }

  await prisma.periodeTarifaire.delete({ where: { id } });
  return NextResponse.json({ supprime: true });
}
