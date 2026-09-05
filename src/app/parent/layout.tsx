import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ParentShell } from "@/components/parent/ParentShell";
import { AuthenticatedArea } from "@/components/auth/AuthenticatedArea";

export default async function ParentLayout({ children }: LayoutProps<"/parent">) {
  const session = await auth();
  // Le middleware (src/middleware.ts) gate déjà /parent/* par rôle (avec ?from
  // et ?raison=expiree) ; ce contrôle est une seconde ligne de défense.
  if (!session || session.error || session.user.role !== "PARENT") {
    redirect(session?.error ? "/connexion?raison=expiree" : "/connexion");
  }

  return (
    <AuthenticatedArea session={session}>
      <ParentShell>{children}</ParentShell>
    </AuthenticatedArea>
  );
}
