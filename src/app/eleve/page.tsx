import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { IconBell } from "@/components/icons";
import { LacuneBar } from "@/components/eleve/LacuneBar";
import { Avatar } from "@/components/ui/Avatar";

const CLASSE_LABELS: Record<string, string> = {
  TROISIEME: "3e",
  PREMIERE: "1ère",
  TERMINALE: "Terminale",
};

export default async function EleveDashboardPage() {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ELEVE") {
    redirect("/connexion");
  }
  const eleveId = session.user.id;
  const nom = session.user.nom ?? "";
  const classe = session.user.classe ? (CLASSE_LABELS[session.user.classe] ?? session.user.classe) : "";
  const filiere = session.user.filiere;

  const debutAujourdhui = new Date();
  debutAujourdhui.setHours(0, 0, 0, 0);

  const [dernieresCorrections, lacunes, quizAujourdhui, notes] = await Promise.all([
    prisma.correctionDetail.findMany({
      where: { eleveId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { note: true, epreuve: { select: { titre: true } }, matiere: { select: { nom: true } } },
    }),
    prisma.lacune.findMany({
      where: { eleveId, resolu: false },
      orderBy: { niveauMaitrise: "asc" },
      take: 3,
      select: { notion: true, niveauMaitrise: true },
    }),
    prisma.quiz.findMany({
      where: { eleveId, dateGeneration: { gte: debutAujourdhui } },
      select: { statut: true },
    }),
    prisma.correctionDetail.findMany({ where: { eleveId }, select: { note: true } }),
  ]);

  const notesValides = notes.map((n) => n.note).filter((n): n is number => n !== null);
  const progressionGenerale =
    notesValides.length > 0
      ? Math.round((notesValides.reduce((s, n) => s + n, 0) / notesValides.length / 20) * 100)
      : null;

  const quizTermines = quizAujourdhui.filter((q) => q.statut === "TERMINE").length;
  const quizRestants = quizAujourdhui.length - quizTermines;
  const lacunePrioritaire = lacunes[0];
  const aUnObjectifDuJour = quizAujourdhui.length > 0 || Boolean(lacunePrioritaire);
  const pourcentageObjectif =
    quizAujourdhui.length > 0 ? Math.round((quizTermines / quizAujourdhui.length) * 100) : 0;

  return (
    <main className="max-w-5xl px-6 py-8 sm:px-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-texte">Bonjour, {nom} 👋</h1>
          <p className="mt-1 text-sm text-texte-muted">
            {classe}
            {filiere ? ` · Série ${filiere}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-texte-muted shadow-sm"
          >
            <IconBell className="h-5 w-5" aria-hidden="true" />
          </button>
          <Avatar seed={eleveId} nom={nom} size={40} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl bg-primary p-6 text-white">
          <p className="text-xs font-semibold tracking-wide text-white/70 uppercase">🎯 Ton objectif du jour</p>
          {aUnObjectifDuJour ? (
            <div className="mt-3 space-y-1.5 text-sm">
              {quizAujourdhui.length > 0 && (
                <p>
                  ✅ {quizTermines} exercice{quizTermines > 1 ? "s" : ""} terminé{quizTermines > 1 ? "s" : ""} · {quizRestants} restant
                  {quizRestants > 1 ? "s" : ""}
                </p>
              )}
              {lacunePrioritaire && <p>🧠 1 lacune à renforcer — {lacunePrioritaire.notion}</p>}
            </div>
          ) : (
            <p className="mt-2 text-base">
              Pas encore d&apos;objectif aujourd&apos;hui — reviens ici après ta première épreuve corrigée.
            </p>
          )}
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${pourcentageObjectif}%` }} />
          </div>
        </div>
        <div className="rounded-2xl bg-surface p-6 shadow-sm">
          <p className="text-sm font-medium text-texte-muted">Progression générale</p>
          {progressionGenerale !== null ? (
            <p className="mt-2 font-serif text-4xl font-bold text-texte">{progressionGenerale}%</p>
          ) : (
            <p className="mt-4 text-sm text-texte-muted">Pas encore de données.</p>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-base font-bold text-texte">Dernières épreuves</h2>
          {dernieresCorrections.length === 0 ? (
            <p className="mt-3 text-sm text-texte-muted">
              Rien pour l&apos;instant. Tes épreuves corrigées apparaîtront ici.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-border">
              {dernieresCorrections.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-semibold text-texte">{c.epreuve.titre}</p>
                    <p className="text-xs text-texte-muted">{c.matiere.nom}</p>
                  </div>
                  <p className="font-serif text-lg font-bold text-texte">{c.note ?? "—"}/20</p>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-base font-bold text-texte">Lacunes à travailler</h2>
          {lacunes.length === 0 ? (
            <p className="mt-3 text-sm text-texte-muted">
              Pas encore de lacune détectée — elle apparaîtra après ta première épreuve corrigée.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {lacunes.map((l) => (
                <LacuneBar key={l.notion} notion={l.notion} niveauMaitrise={l.niveauMaitrise} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
