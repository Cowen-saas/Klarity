import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { chargerPaiementAutorise } from "@/lib/payment/idor";
import { VerificationPoll } from "@/components/abonnement/VerificationPoll";

export default async function VerificationPage({ params }: PageProps<"/abonnement/verification/[id]">) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.error) {
    redirect("/connexion?from=/abonnement");
  }

  const paiement = await chargerPaiementAutorise(id, session);
  if (!paiement) redirect("/abonnement");

  const eleveId = paiement.abonnement.eleveId;
  const retourDashboard = session.user.role === "PARENT" ? `/parent?eleve=${eleveId}` : "/eleve";

  return (
    <VerificationPoll
      paiementId={paiement.id}
      statutInitial={paiement.statut}
      eleveId={eleveId}
      retourDashboard={retourDashboard}
    />
  );
}
