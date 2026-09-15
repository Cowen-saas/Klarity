import { prisma } from "@/lib/prisma";
import type { Filiere, NiveauClasse } from "@prisma/client";

export interface EnfantLie {
  id: string;
  nom: string;
  classe: NiveauClasse;
  filiere: Filiere | null;
  derniereActiviteLe: Date | null;
}

export interface ContexteEleveParent {
  liens: { eleveId: string; eleve: EnfantLie }[];
  eleve: EnfantLie | null;
  selectedId: string | null;
}

/**
 * Résolution partagée "quel enfant le parent consulte-t-il" (§2.2), utilisée
 * par toutes les pages parent (vue d'ensemble, progression, notes, lacunes,
 * export PDF) — centralisée pour ne pas répéter la vérification IDOR à
 * chaque écran (réf. sécurité §5) : `?eleve=` n'est **jamais** fait
 * confiance sans vérifier son appartenance à `ParentEleveLink`.
 */
export async function resoudreContexteEleve(parentId: string, eleveIdParam?: string): Promise<ContexteEleveParent> {
  const [liens, parent] = await Promise.all([
    prisma.parentEleveLink.findMany({
      where: { parentId },
      include: {
        eleve: { select: { id: true, nom: true, classe: true, filiere: true, derniereActiviteLe: true } },
      },
      orderBy: { dateLiaison: "asc" },
    }),
    prisma.parent.findUnique({ where: { id: parentId }, select: { dernierEleveConsulteId: true } }),
  ]);

  if (liens.length === 0) {
    return { liens: [], eleve: null, selectedId: null };
  }

  const idsLies = new Set(liens.map((l) => l.eleveId));
  let selectedId = eleveIdParam && idsLies.has(eleveIdParam) ? eleveIdParam : null;
  if (!selectedId) {
    selectedId =
      parent?.dernierEleveConsulteId && idsLies.has(parent.dernierEleveConsulteId)
        ? parent.dernierEleveConsulteId
        : liens[0].eleveId;
  }

  const lien = liens.find((l) => l.eleveId === selectedId)!;
  return { liens, eleve: lien.eleve, selectedId };
}

export const CLASSE_LABELS: Record<string, string> = {
  TROISIEME: "3e",
  PREMIERE: "1ère",
  TERMINALE: "Terminale",
};
