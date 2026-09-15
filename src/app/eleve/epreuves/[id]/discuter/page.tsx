import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Filiere, NiveauClasse } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ChatPanel } from "@/components/tuteur-ia/ChatPanel";

export const metadata: Metadata = {
  title: "Discuter de ma copie — Klarity",
};

/**
 * Chat mode 2 (§2.1, §2.1.1, §4.4) — accessible uniquement depuis l'écran de
 * résultat d'une correction déjà produite ("Discuter de cette copie",
 * `ResultatCorrection.tsx`). Structurellement séparé du chat mode 1
 * (`/eleve/tuteur-ia`, route distincte) — jamais nested dans le même widget
 * (CLAUDE.md).
 *
 * IDOR (réf. sécurité §5) : épreuve filtrée par classe/filière de l'élève ;
 * 404 si aucune `CorrectionDetail` n'existe encore pour ce couple — rien à
 * discuter avant qu'une correction existe (même règle que côté API).
 */
export default async function DiscuterCopiePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ELEVE") {
    redirect("/connexion?from=/eleve/epreuves");
  }

  const { id: epreuveId } = await params;
  const classe = session.user.classe as NiveauClasse;
  const filiere = (session.user.filiere ?? null) as Filiere | null;

  const epreuve = await prisma.epreuve.findFirst({ where: { id: epreuveId, classe, filiere }, select: { id: true, titre: true } });
  const correction = epreuve
    ? await prisma.correctionDetail.findUnique({
        where: { epreuveId_eleveId: { epreuveId, eleveId: session.user.id } },
        select: { id: true },
      })
    : null;
  if (!epreuve || !correction) notFound();

  return (
    <main className="max-w-3xl px-6 py-4 sm:px-8 sm:py-8">
      <ChatPanel
        contexteEpreuve={{
          epreuveId: epreuve.id,
          titre: epreuve.titre,
          retourHref: `/eleve/epreuves/${epreuve.id}/correction`,
        }}
      />
    </main>
  );
}
