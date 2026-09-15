import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MesLacunes } from "@/components/eleve/MesLacunes";

export const metadata: Metadata = {
  title: "Mes lacunes — Klarity",
};

/**
 * Écran "Mes lacunes" (§2.1, maquette 09), alimenté par de vraies
 * `Lacune` (créées par le pipeline de correction, Passe 2). Ne montre que
 * les lacunes actives (`resolu: false`) — une lacune résolue n'a plus sa
 * place dans un écran conçu pour dire à l'élève quoi travailler maintenant.
 *
 * Le texte explicatif par lacune (maquette : "Tu confonds souvent...") n'est
 * stocké nulle part sur `Lacune` elle-même — réutilisé depuis
 * `CorrectionDetail.pointsManques[].detail` de la correction qui a créé/mis
 * à jour la lacune (`Lacune.sourceTentativeId`, qui malgré son nom pointe
 * vers un id `CorrectionDetail`), plutôt que de refaire un appel IA pour
 * produire un texte qui existe déjà.
 *
 * Recommandation vidéo (§2.5) et quiz ciblé (Passe 4) hors scope de cette
 * passe — pipeline vidéo pas encore construit, quiz pas encore câblé :
 * la carte vidéo est omise, le bouton quiz reste désactivé ("Bientôt").
 */
export default async function MesLacunesPage() {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ELEVE") {
    redirect("/connexion?from=/eleve/lacunes");
  }

  const lacunes = await prisma.lacune.findMany({
    where: { eleveId: session.user.id, resolu: false },
    orderBy: { niveauMaitrise: "asc" },
    include: { matiere: { select: { nom: true } }, sourceCorrection: { select: { pointsManques: true } } },
  });

  const lacunesVue = lacunes.map((l) => {
    const pointsManques = (l.sourceCorrection?.pointsManques as { notion: string; detail: string }[] | null) ?? [];
    const explication = pointsManques.find((pm) => pm.notion === l.notion)?.detail ?? null;
    return {
      id: l.id,
      notion: l.notion,
      matiere: l.matiere.nom,
      niveauMaitrise: l.niveauMaitrise,
      explication,
    };
  });

  return (
    <main className="max-w-5xl px-6 py-8 sm:px-8">
      <MesLacunes lacunes={lacunesVue} />
    </main>
  );
}
