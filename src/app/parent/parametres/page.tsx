import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ClotureCompteForm } from "@/components/parent/ClotureCompteForm";

const CLASSE_LABELS: Record<string, string> = {
  TROISIEME: "3e",
  PREMIERE: "1ère",
  TERMINALE: "Terminale",
};

/**
 * Paramètres parent — pour l'instant : clôture immédiate du compte d'un enfant
 * (§2.9.1, maquette 12b). Sélection de l'enfant via `?eleve=`, appartenance du
 * lien re-vérifiée côté serveur (IDOR).
 */
export default async function ParentParametresPage({
  searchParams,
}: {
  searchParams: Promise<{ eleve?: string }>;
}) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "PARENT") {
    redirect("/connexion");
  }

  const liens = await prisma.parentEleveLink.findMany({
    where: { parentId: session.user.id },
    orderBy: { dateLiaison: "asc" },
    select: { eleve: { select: { id: true, nom: true, codeEleve: true, classe: true, statutCompte: true } } },
  });

  if (liens.length === 0) {
    return (
      <main className="max-w-3xl px-6 py-10 sm:px-8">
        <h1 className="text-2xl font-bold text-texte">Paramètres</h1>
        <p className="mt-2 text-sm text-texte-muted">Aucun enfant lié à ton compte pour l&apos;instant.</p>
      </main>
    );
  }

  const { eleve: eleveParam } = await searchParams;
  const idsLies = new Set(liens.map((l) => l.eleve.id));
  const selectedId = eleveParam && idsLies.has(eleveParam) ? eleveParam : liens[0].eleve.id;
  const enfant = liens.find((l) => l.eleve.id === selectedId)!.eleve;

  return (
    <main className="max-w-4xl px-6 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-texte">Paramètres</h1>
      <p className="mt-1 text-sm text-texte-muted">Clôture du compte d&apos;un enfant.</p>

      {liens.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2" role="radiogroup" aria-label="Choisir un enfant">
          {liens.map((l) => {
            const actif = l.eleve.id === selectedId;
            return (
              <Link
                key={l.eleve.id}
                href={`/parent/parametres?eleve=${l.eleve.id}`}
                role="radio"
                aria-checked={actif}
                className={`rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors ${
                  actif ? "border-primary bg-primary-light text-primary" : "border-border bg-surface text-texte"
                }`}
              >
                {l.eleve.nom}
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        {enfant.statutCompte === "ANONYMISE" ? (
          <div className="rounded-2xl bg-surface p-6 shadow-sm">
            <h2 className="text-base font-bold text-texte">Compte clôturé</h2>
            <p className="mt-2 text-sm text-texte-muted">
              Le compte de cet enfant a été clôturé. Les données pédagogiques ont été définitivement supprimées ; les
              données de facturation sont conservées séparément pour raisons légales.
            </p>
          </div>
        ) : (
          <ClotureCompteForm
            eleveId={enfant.id}
            nom={enfant.nom}
            codeEleve={enfant.codeEleve}
            classeLabel={CLASSE_LABELS[enfant.classe] ?? enfant.classe}
          />
        )}
      </div>
    </main>
  );
}
