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
 * Recommandation vidéo (§2.5, Passe 2 du chantier vidéo) : résolue ici
 * directement depuis `LacuneVideoCache`/`Video` (déjà peuplés en tâche de
 * fond par le pipeline, cf. `src/lib/video/pipeline.ts`) — jamais un nouvel
 * appel YouTube/Haiku déclenché depuis cette page (lecture seule, §3). Une
 * notion sans entrée de cache signifie que le pipeline n'est pas encore
 * passé dessus (job en file ou pas encore déclenché) ; une entrée avec un
 * tableau vide signifie qu'aucune vidéo pertinente n'a été retenue — les
 * deux cas affichent l'absence de carte plutôt qu'une erreur.
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

  const notions = [...new Set(lacunes.map((l) => l.notion))];
  const caches = await prisma.lacuneVideoCache.findMany({
    where: { notionCle: { in: notions } },
    select: { notionCle: true, videoIdsJson: true },
  });
  const premierVideoIdParNotion = new Map(
    caches.map((c) => [c.notionCle, (c.videoIdsJson as string[])[0] as string | undefined])
  );
  const videoIdsAResoudre = [...premierVideoIdParNotion.values()].filter((id): id is string => Boolean(id));
  const videos = await prisma.video.findMany({
    where: { id: { in: videoIdsAResoudre } },
    select: { id: true, titre: true, providerVideoId: true },
  });
  const videoParId = new Map(videos.map((v) => [v.id, v]));

  const lacunesVue = lacunes.map((l) => {
    const pointsManques = (l.sourceCorrection?.pointsManques as { notion: string; detail: string }[] | null) ?? [];
    const explication = pointsManques.find((pm) => pm.notion === l.notion)?.detail ?? null;
    const videoId = premierVideoIdParNotion.get(l.notion);
    const video = videoId ? videoParId.get(videoId) : undefined;
    return {
      id: l.id,
      notion: l.notion,
      matiere: l.matiere.nom,
      niveauMaitrise: l.niveauMaitrise,
      explication,
      video: video ? { titre: video.titre, providerVideoId: video.providerVideoId } : null,
    };
  });

  return (
    <main className="max-w-5xl px-6 py-8 sm:px-8">
      <MesLacunes lacunes={lacunesVue} />
    </main>
  );
}
