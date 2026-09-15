import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { resoudreContexteEleve, CLASSE_LABELS } from "@/lib/parent/contexte-eleve";
import { calculerAlertes } from "@/lib/parent/alertes";

/**
 * Export PDF du rapport mensuel parent (§2.2) — génération à la demande à
 * partir des données existantes, **pas de stockage persistant** (CDC v1.10) :
 * le PDF est construit en mémoire à chaque requête et streamé directement,
 * jamais écrit sur `StorageProvider`. Reprend les indicateurs déjà affichés
 * sur la vue d'ensemble (`/parent`) — pas de maquette dédiée, template
 * construit pour rester lisible imprimé (pas de dépendance aux couleurs du
 * design system web).
 *
 * IDOR (réf. sécurité §5) : `?eleve=` résolu via `resoudreContexteEleve`,
 * jamais fait confiance sans vérifier l'appartenance à `ParentEleveLink`.
 */
export async function GET(request: Request) {
  const garde = await exigerRole("PARENT");
  if (!garde.ok) return garde.response;

  const eleveParam = new URL(request.url).searchParams.get("eleve") ?? undefined;
  const { eleve } = await resoudreContexteEleve(garde.session.user.id, eleveParam);
  if (!eleve) {
    return NextResponse.json({ error: "Élève introuvable." }, { status: 404 });
  }
  const classeLabel = CLASSE_LABELS[eleve.classe] ?? eleve.classe;

  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);
  const debutSemaine = new Date();
  debutSemaine.setDate(debutSemaine.getDate() - 7);

  const [corrections, correctionsMois, lacunesActives, sessionsSemaine, alertes] = await Promise.all([
    prisma.correctionDetail.findMany({ where: { eleveId: eleve.id }, select: { note: true } }),
    prisma.correctionDetail.findMany({
      where: { eleveId: eleve.id, createdAt: { gte: debutMois } },
      orderBy: { createdAt: "desc" },
      select: { note: true, createdAt: true, epreuve: { select: { titre: true } }, matiere: { select: { nom: true } } },
    }),
    prisma.lacune.findMany({ where: { eleveId: eleve.id, resolu: false }, orderBy: { niveauMaitrise: "asc" }, select: { notion: true, niveauMaitrise: true, matiere: { select: { nom: true } } } }),
    prisma.sessionActivite.findMany({ where: { eleveId: eleve.id, dateDebut: { gte: debutSemaine } }, select: { dureeSecondes: true } }),
    calculerAlertes(eleve.id),
  ]);

  const notesValides = corrections.map((c) => c.note).filter((n): n is number => n !== null);
  const moyenneGenerale = notesValides.length > 0 ? notesValides.reduce((s, n) => s + n, 0) / notesValides.length : null;
  const tempsSemaineH = (sessionsSemaine.reduce((s, x) => s + (x.dureeSecondes ?? 0), 0) / 3600).toFixed(1);
  const nomMois = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const fini = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.fontSize(20).font("Helvetica-Bold").text("Klarity — Rapport mensuel", { align: "left" });
  doc.fontSize(11).font("Helvetica").fillColor("#5b6b70").text(`${eleve.nom} · ${classeLabel}${eleve.filiere ? ` · Série ${eleve.filiere}` : ""}`);
  doc.text(`Période : ${nomMois}`);
  doc.moveDown(1.2);

  doc.fillColor("#16211f").fontSize(13).font("Helvetica-Bold").text("Indicateurs clés");
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica");
  const indicateurs: [string, string][] = [
    ["Moyenne générale", moyenneGenerale !== null ? `${moyenneGenerale.toFixed(1).replace(".", ",")}/20` : "—"],
    ["Épreuves réalisées (total)", String(corrections.length)],
    ["Épreuves corrigées ce mois-ci", String(correctionsMois.length)],
    ["Temps passé cette semaine", `${tempsSemaineH} h`],
    ["Lacunes actives", String(lacunesActives.length)],
  ];
  for (const [label, valeur] of indicateurs) {
    doc.text(`${label} : `, { continued: true }).font("Helvetica-Bold").text(valeur).font("Helvetica");
  }
  doc.moveDown(1);

  doc.fontSize(13).font("Helvetica-Bold").text("Épreuves corrigées ce mois-ci");
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica");
  if (correctionsMois.length === 0) {
    doc.fillColor("#5b6b70").text("Aucune épreuve corrigée ce mois-ci.");
  } else {
    for (const c of correctionsMois) {
      doc
        .fillColor("#16211f")
        .text(`${c.epreuve.titre} (${c.matiere.nom}) — ${c.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} : `, { continued: true })
        .font("Helvetica-Bold")
        .text(`${c.note ?? "—"}/20`)
        .font("Helvetica");
    }
  }
  doc.moveDown(1);

  doc.fillColor("#16211f").fontSize(13).font("Helvetica-Bold").text("Lacunes actives");
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica");
  if (lacunesActives.length === 0) {
    doc.fillColor("#5b6b70").text("Aucune lacune active.");
  } else {
    for (const l of lacunesActives) {
      doc.fillColor("#16211f").text(`${l.notion} (${l.matiere.nom}) — ${l.niveauMaitrise}% de maîtrise`);
    }
  }
  doc.moveDown(1);

  doc.fillColor("#16211f").fontSize(13).font("Helvetica-Bold").text("Alertes intelligentes");
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica");
  const toutesAlertes = [
    ...alertes.critiques.map((a) => `[Critique] ${a.texte}`),
    ...alertes.aSurveiller.map((a) => `[À surveiller] ${a.texte}`),
    ...alertes.info.map((a) => `[Info] ${a.texte}`),
  ];
  if (toutesAlertes.length === 0) {
    doc.fillColor("#5b6b70").text("Aucune alerte pour l'instant.");
  } else {
    for (const texte of toutesAlertes) {
      doc.fillColor("#16211f").text(texte);
    }
  }

  doc.moveDown(2);
  doc.fontSize(8).fillColor("#5b6b70").text("Généré à la demande par Klarity — ne montre jamais le contenu des conversations ni l'activité minute par minute.");

  doc.end();
  const buffer = await fini;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport-klarity-${eleve.nom.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
    },
  });
}
