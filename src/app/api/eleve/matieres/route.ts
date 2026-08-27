import { NextResponse } from "next/server";
import type { Filiere, NiveauClasse } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Matières disponibles au chat-tuteur mode 1 pour l'élève connecté (§2.1, §4.4) —
 * calculées via ProgrammeOfficiel (classe + filière exactes), jamais via
 * Matiere.classesConcernees/filiereRequise (trop imprécis, cf. décision seed).
 */
export async function GET() {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ELEVE") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const classe = session.user.classe as NiveauClasse;
  const filiere = (session.user.filiere ?? null) as Filiere | null;

  const programmes = await prisma.programmeOfficiel.findMany({
    where: { classe, OR: [{ filiere }, { filiere: null }] },
    select: { matiere: { select: { id: true, nom: true } } },
    distinct: ["matiereId"],
  });

  const matieres = programmes
    .map((p) => p.matiere)
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  return NextResponse.json({ matieres });
}
