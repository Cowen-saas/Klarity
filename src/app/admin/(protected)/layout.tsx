import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await auth();
  // Le middleware (src/middleware.ts) gate déjà /admin/* par rôle ; ce
  // contrôle est une seconde ligne de défense côté layout serveur. Le groupe
  // de routes (protected) exclut délibérément /admin/connexion de ce layout —
  // sinon la page de login se redirigerait vers elle-même en boucle.
  if (!session || session.error || session.user.role !== "ADMIN") {
    redirect("/admin/connexion");
  }

  const correctionsSignaleesCount = await prisma.correctionDetail.count({ where: { signalee: true } });

  return <AdminShell correctionsSignaleesCount={correctionsSignaleesCount}>{children}</AdminShell>;
}
