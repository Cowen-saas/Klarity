import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/AdminShell";
import { AuthenticatedArea } from "@/components/auth/AuthenticatedArea";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await auth();
  // Le middleware (src/middleware.ts) gate déjà /admin/* par rôle (avec ?from
  // et ?raison=expiree) ; ce contrôle est une seconde ligne de défense. Le
  // groupe de routes (protected) exclut délibérément /admin/connexion de ce
  // layout — sinon la page de login se redirigerait vers elle-même en boucle.
  if (!session || session.error || session.user.role !== "ADMIN") {
    redirect(session?.error ? "/admin/connexion?raison=expiree" : "/admin/connexion");
  }

  const correctionsSignaleesCount = await prisma.correctionDetail.count({ where: { signalee: true } });

  return (
    <AuthenticatedArea session={session}>
      <AdminShell correctionsSignaleesCount={correctionsSignaleesCount}>{children}</AdminShell>
    </AuthenticatedArea>
  );
}
