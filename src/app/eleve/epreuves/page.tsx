import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { Filiere, NiveauClasse } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage";
import { BanqueEpreuves } from "@/components/eleve/BanqueEpreuves";

export const metadata: Metadata = {
  title: "Banque d'épreuves — Klarity",
};

const CLASSE_LABELS: Record<NiveauClasse, string> = {
  TROISIEME: "3ᵉ",
  PREMIERE: "1ʳᵉ",
  TERMINALE: "Terminale",
};

/**
 * Banque d'épreuves de l'élève (§2.1, maquette 06_banque_epreuves.png). Un élève
 * ne voit que les épreuves de sa propre classe/série (§2.1, §4.3) — le filtrage
 * se fait ici, côté serveur, jamais seulement dans l'UI. Les PDF (fiche +
 * corrigé de référence) sont servis via des URL signées expirantes de R2,
 * régénérées à chaque rendu — aucune URL publique n'est jamais stockée (§3, §4.2).
 */
export default async function EleveEpreuvesPage() {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ELEVE") {
    redirect("/connexion?from=/eleve/epreuves");
  }

  const classe = session.user.classe as NiveauClasse;
  const filiere = (session.user.filiere ?? null) as Filiere | null;

  const epreuves = await prisma.epreuve.findMany({
    where: { classe, filiere },
    orderBy: [{ matiere: { nom: "asc" } }, { anneeScolaire: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      titre: true,
      anneeScolaire: true,
      fichePdfKey: true,
      corrigeReferenceKey: true,
      matiere: { select: { nom: true } },
    },
  });

  const storage = getStorageProvider();
  const epreuvesVue = await Promise.all(
    epreuves.map(async ({ fichePdfKey, corrigeReferenceKey, matiere, ...e }) => ({
      ...e,
      matiere: matiere.nom,
      ficheUrl: await storage.obtenirUrlSignee(fichePdfKey),
      corrigeUrl: await storage.obtenirUrlSignee(corrigeReferenceKey),
    })),
  );

  const classeLabel = `${CLASSE_LABELS[classe] ?? classe}${filiere ? ` · Série ${filiere}` : ""}`;

  return (
    <main className="max-w-5xl px-6 py-8 sm:px-8">
      <BanqueEpreuves epreuves={epreuvesVue} classeLabel={classeLabel} />
    </main>
  );
}
