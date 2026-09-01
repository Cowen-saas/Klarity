import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage";
import { EpreuveManager } from "@/components/admin/EpreuveManager";

export const metadata: Metadata = {
  title: "Épreuves — Admin Klarity",
  robots: { index: false, follow: false },
};

/**
 * Gestion de la banque d'épreuves (§2.3, §4.2, §4.3). L'outil est prêt ;
 * la banque réelle sera alimentée quand la source externe (Supabase tierce)
 * sera accessible. Les PDF passent par `StorageProvider` (mock disque tant que
 * Cloudflare R2 n'est pas configuré).
 */
export default async function AdminEpreuvesPage() {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    redirect("/admin/connexion");
  }

  const [epreuves, matieres] = await Promise.all([
    prisma.epreuve.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        titre: true,
        classe: true,
        filiere: true,
        anneeScolaire: true,
        createdAt: true,
        fichePdfKey: true,
        corrigeReferenceKey: true,
        matiere: { select: { nom: true } },
      },
    }),
    prisma.matiere.findMany({
      where: { banqueDisponible: true },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, classesConcernees: true, filiereRequise: true },
    }),
  ]);

  // URLs signées expirantes (jamais d'URL publique stockée) — régénérées à
  // chaque rendu de la page.
  const storage = getStorageProvider();
  const epreuvesVue = await Promise.all(
    epreuves.map(async ({ fichePdfKey, corrigeReferenceKey, ...e }) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
      ficheUrl: await storage.obtenirUrlSignee(fichePdfKey),
      corrigeUrl: await storage.obtenirUrlSignee(corrigeReferenceKey),
    }))
  );

  return (
    <main className="max-w-5xl px-6 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-texte">Épreuves</h1>
      <p className="mt-1 text-sm text-texte-muted">
        Ajout d&apos;une épreuve à la banque : fiche PDF + corrigé de référence, rangés dans le stockage sécurisé.
      </p>

      <div className="mt-6">
        <EpreuveManager epreuves={epreuvesVue} matieres={matieres} />
      </div>
    </main>
  );
}
