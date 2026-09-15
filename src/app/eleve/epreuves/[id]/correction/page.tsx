import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Filiere, NiveauClasse } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UploadCopie } from "@/components/eleve/UploadCopie";
import { ResultatCorrection } from "@/components/eleve/ResultatCorrection";

export const metadata: Metadata = {
  title: "Correction IA — Klarity",
};

const CLASSE_LABELS: Record<NiveauClasse, string> = {
  TROISIEME: "3ᵉ",
  PREMIERE: "1ʳᵉ",
  TERMINALE: "Terminale",
};

/**
 * Point d'entrée unique du pipeline de correction (§2.1, §4.3, §6.2) —
 * maquettes 07 (upload/analyse) et 08 (résultat détaillé). Décide côté
 * serveur, à partir de l'état réel en base, quel écran rendre :
 *
 *  - `?nouvelleTentative=1` (bouton "Recommencer l'épreuve") force l'écran
 *    d'upload même si une correction existe déjà — nouvelle pratique
 *    gratuite, jamais un nouveau traitement IA (§2.1, §6.4).
 *  - une `CorrectionDetail` existe déjà -> écran résultat (08).
 *  - une tentative n°1 est en attente/en traitement -> écran upload en mode
 *    "analyse en cours" (07, panneau droit), avec sondage client.
 *  - sinon -> écran upload vierge (07, panneau gauche).
 */
export default async function CorrectionEpreuvePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nouvelleTentative?: string }>;
}) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ELEVE") {
    redirect("/connexion?from=/eleve/epreuves");
  }

  const { id: epreuveId } = await params;
  const { nouvelleTentative } = await searchParams;
  const classe = session.user.classe as NiveauClasse;
  const filiere = (session.user.filiere ?? null) as Filiere | null;
  const eleveId = session.user.id;

  // IDOR (réf. sécurité §5) : même filtrage que la banque d'épreuves — une
  // épreuve hors classe/filière de l'élève est traitée comme introuvable.
  const epreuve = await prisma.epreuve.findFirst({
    where: { id: epreuveId, classe, filiere },
    select: { id: true, titre: true, anneeScolaire: true, matiere: { select: { nom: true } } },
  });
  if (!epreuve) notFound();

  const classeLabel = `${CLASSE_LABELS[classe] ?? classe}${filiere ? ` ${filiere}` : ""}`;
  const forcerUpload = nouvelleTentative === "1";

  if (!forcerUpload) {
    const correction = await prisma.correctionDetail.findUnique({
      where: { epreuveId_eleveId: { epreuveId, eleveId } },
    });
    if (correction) {
      return (
        <main className="max-w-4xl px-6 py-8 sm:px-8">
          <ResultatCorrection
            epreuveId={epreuve.id}
            titre={epreuve.titre}
            matiere={epreuve.matiere.nom}
            classeLabel={classeLabel}
            anneeScolaire={epreuve.anneeScolaire}
            correction={{
              id: correction.id,
              note: correction.note,
              pointsForts: correction.pointsForts as string[],
              pointsManques: correction.pointsManques as { notion: string; detail: string }[],
              feedbackDetaille: correction.feedbackDetaille,
              signalee: correction.signalee,
            }}
          />
        </main>
      );
    }
  }

  const tentativeEnCours = await prisma.tentativeEpreuve.findFirst({
    where: { eleveId, epreuveId, numeroTentative: 1, statut: { in: ["EN_ATTENTE", "EN_TRAITEMENT"] } },
    select: { id: true, statut: true },
  });

  return (
    <main className="max-w-4xl px-6 py-8 sm:px-8">
      <UploadCopie
        epreuveId={epreuve.id}
        titre={epreuve.titre}
        matiere={epreuve.matiere.nom}
        tentativeInitiale={tentativeEnCours}
      />
    </main>
  );
}
