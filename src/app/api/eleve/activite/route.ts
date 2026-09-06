import { NextResponse } from "next/server";
import { z } from "zod";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

/**
 * Enregistre un segment de temps réellement passé par l'élève sur la plateforme
 * web (§4.3, `SessionActivite` ; brief fondateur : « le temps passé sur la
 * plateforme par jour »). Alimenté par `ActivityTracker` côté client via
 * `navigator.sendBeacon`.
 *
 * Le payload vient du client → **non fiable**. Deux garde-fous serveur :
 *  - `SEGMENT_MAX_SECONDES` : un envoi ne peut jamais porter plus de 15 min
 *    (le tracker envoie bien plus souvent en pratique) ;
 *  - `PLAFOND_QUOTIDIEN_SECONDES` : le total du jour pour un élève est plafonné
 *    (8 h) — une session laissée ouverte ou un client trafiqué ne peut pas
 *    gonfler artificiellement le temps affiché aux parents.
 *
 * `sendBeacon` ne lit pas la réponse : on répond toujours 2xx (sauf session
 * absente), l'échec éventuel est silencieux et sans conséquence.
 */
const SEGMENT_MAX_SECONDES = 15 * 60;
const PLAFOND_QUOTIDIEN_SECONDES = 8 * 60 * 60;

const bodySchema = z.object({
  dureeSecondes: z.coerce.number().int().positive().max(SEGMENT_MAX_SECONDES * 4),
});

export async function POST(request: Request) {
  const garde = await exigerRole("ELEVE");
  if (!garde.ok) return garde.response;
  const eleveId = garde.session.user.id;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  let duree = Math.min(parsed.data.dureeSecondes, SEGMENT_MAX_SECONDES);

  const debutJour = new Date();
  debutJour.setHours(0, 0, 0, 0);

  const dejaAujourdhui = await prisma.sessionActivite.aggregate({
    where: { eleveId, dateDebut: { gte: debutJour } },
    _sum: { dureeSecondes: true },
  });
  const cumulJour = dejaAujourdhui._sum.dureeSecondes ?? 0;

  if (cumulJour >= PLAFOND_QUOTIDIEN_SECONDES) {
    return NextResponse.json({ ok: true, ignore: "plafond quotidien atteint" });
  }
  duree = Math.min(duree, PLAFOND_QUOTIDIEN_SECONDES - cumulJour);

  const fin = new Date();
  const debut = new Date(fin.getTime() - duree * 1000);

  await prisma.$transaction([
    prisma.sessionActivite.create({
      data: { eleveId, dateDebut: debut, dateFin: fin, dureeSecondes: duree, canal: "WEB" },
    }),
    prisma.eleve.update({ where: { id: eleveId }, data: { derniereActiviteLe: fin } }),
  ]);

  return NextResponse.json({ ok: true });
}
