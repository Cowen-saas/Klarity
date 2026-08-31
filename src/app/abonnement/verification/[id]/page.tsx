import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { chargerPaiementAutorise } from "@/lib/payment/idor";
import { PaiementStepper } from "@/components/abonnement/PaiementStepper";
import { VerificationPoll } from "@/components/abonnement/VerificationPoll";

export default async function VerificationPage({ params }: PageProps<"/abonnement/verification/[id]">) {
  const { id } = await params;
  const session = await auth();
  if (!session) return null;

  const paiement = await chargerPaiementAutorise(id, session);
  if (!paiement) redirect("/abonnement");

  const eleveId = paiement.abonnement.eleveId;
  const retourDashboard = session.user.role === "PARENT" ? `/parent?eleve=${eleveId}` : "/eleve";

  return (
    <div className="mx-auto max-w-4xl">
      <PaiementStepper step={paiement.statut === "EN_ATTENTE" ? 3 : 4} />
      <VerificationPoll
        paiementId={paiement.id}
        statutInitial={paiement.statut}
        eleveId={eleveId}
        retourDashboard={retourDashboard}
      />
    </div>
  );
}
