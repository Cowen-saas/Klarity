import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { obtenirTarifPremium } from "@/lib/payment/tarification";
import { PaiementStepper } from "@/components/abonnement/PaiementStepper";
import { PaiementForm } from "@/components/abonnement/PaiementForm";

export default async function PaiementPage({ searchParams }: PageProps<"/abonnement/paiement">) {
  const session = await auth();
  if (!session || session.error || (session.user.role !== "ELEVE" && session.user.role !== "PARENT")) {
    redirect("/abonnement/eleve-ou-parent");
  }

  const { eleve: eleveParam } = await searchParams;
  const idParam = Array.isArray(eleveParam) ? eleveParam[0] : eleveParam;

  let eleveId: string;
  if (session.user.role === "PARENT") {
    if (!idParam) redirect("/abonnement?compte=1");
    const lien = await prisma.parentEleveLink.findUnique({
      where: { parentId_eleveId: { parentId: session.user.id, eleveId: idParam! } },
      select: { id: true },
    });
    if (!lien) redirect("/abonnement?compte=1");
    eleveId = idParam!;
  } else {
    eleveId = session.user.id;
  }

  // Verrou croisé parent/élève (§2.6) — indexé par élève, jamais par payeur :
  // bloque aussi bien un élève qui tenterait de repayer après que son parent
  // a déjà réglé l'abonnement, que l'inverse.
  const abonnement = await prisma.abonnement.findFirst({ where: { eleveId }, orderBy: { dateDebut: "desc" } });
  if (abonnement?.plan === "PREMIUM" && abonnement.statut === "ACTIF") {
    redirect(`/abonnement?compte=1&eleve=${eleveId}`);
  }

  const tarif = obtenirTarifPremium(new Date());

  return (
    <div className="mx-auto max-w-4xl">
      <PaiementStepper step={2} />
      <PaiementForm
        eleveId={eleveId}
        montant={tarif.prix}
        devise="XAF"
        reduction={tarif.reduction}
        prixNormal={tarif.prixNormal}
        payeurRole={session.user.role}
      />
    </div>
  );
}
