import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EleveShell } from "@/components/eleve/EleveShell";
import { AuthenticatedArea } from "@/components/auth/AuthenticatedArea";

export default async function EleveLayout({ children }: LayoutProps<"/eleve">) {
  const session = await auth();
  // Le middleware (src/middleware.ts) gate déjà /eleve/* par rôle (avec ?from
  // et ?raison=expiree) ; ce contrôle est une seconde ligne de défense.
  if (!session || session.error || session.user.role !== "ELEVE") {
    redirect(session?.error ? "/connexion?raison=expiree" : "/connexion");
  }

  return (
    <AuthenticatedArea session={session}>
      <EleveShell>{children}</EleveShell>
    </AuthenticatedArea>
  );
}
