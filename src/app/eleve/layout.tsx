import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EleveShell } from "@/components/eleve/EleveShell";

export default async function EleveLayout({ children }: LayoutProps<"/eleve">) {
  const session = await auth();
  // Le middleware (src/middleware.ts) gate déjà /eleve/* par rôle ; ce
  // contrôle est une seconde ligne de défense côté layout serveur.
  if (!session || session.error || session.user.role !== "ELEVE") {
    redirect("/connexion");
  }

  return (
    <EleveShell eleveId={session.user.id} nom={session.user.nom ?? ""}>
      {children}
    </EleveShell>
  );
}
