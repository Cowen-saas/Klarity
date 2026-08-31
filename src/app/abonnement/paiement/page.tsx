import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { obtenirTarifPremium } from "@/lib/payment/tarification";
import { PaiementStepper } from "@/components/abonnement/PaiementStepper";
import { PaiementForm } from "@/components/abonnement/PaiementForm";

export default async function PaiementPage({ searchParams }: PageProps<"/abonnement/paiement">) {
  const session = await auth();
  if (!session) return null;

  const { eleve: eleveParam } = await searchParams;
  const idParam = Array.isArray(eleveParam) ? eleveParam[0] : eleveParam;

  let eleveId: string;
  if (session.user.role === "PARENT") {
    if (!idParam) redirect("/abonnement");
    const lien = await prisma.parentEleveLink.findUnique({
      where: { parentId_eleveId: { parentId: session.user.id, eleveId: idParam! } },
      select: { id: true },
    });
    if (!lien) redirect("/abonnement");
    eleveId = idParam!;
  } else {
    eleveId = session.user.id;
  }

  const abonnement = await prisma.abonnement.findFirst({ where: { eleveId }, orderBy: { dateDebut: "desc" } });
  if (abonnement?.plan === "PREMIUM" && abonnement.statut === "ACTIF") {
    redirect(`/abonnement?eleve=${eleveId}`);
  }

  const tarif = obtenirTarifPremium(new Date());

  return (
    <div className="mx-auto max-w-4xl">
      <PaiementStepper step={2} />
      <PaiementForm eleveId={eleveId} montant={tarif.prix} devise="XAF" reduction={tarif.reduction} prixNormal={tarif.prixNormal} />
    </div>
  );
}
