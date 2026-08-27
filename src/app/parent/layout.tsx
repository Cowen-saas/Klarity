import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ParentShell } from "@/components/parent/ParentShell";

export default async function ParentLayout({ children }: LayoutProps<"/parent">) {
  const session = await auth();
  // Le middleware (src/middleware.ts) gate déjà /parent/* par rôle ; ce
  // contrôle est une seconde ligne de défense côté layout serveur.
  if (!session || session.error || session.user.role !== "PARENT") {
    redirect("/connexion");
  }

  return <ParentShell>{children}</ParentShell>;
}
