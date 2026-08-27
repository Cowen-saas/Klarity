import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NotificationForm } from "@/components/parent/NotificationForm";

export default async function ParentNotificationsPage() {
  const session = await auth();
  if (!session || session.error || session.user.role !== "PARENT") {
    redirect("/connexion");
  }

  const preference = await prisma.notificationPreference.findUnique({
    where: { parentId: session.user.id },
  });

  return (
    <main className="max-w-5xl px-6 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-texte">Notifications</h1>
      <p className="mt-1 text-sm text-texte-muted">Choisissez comment être informé de la progression de vos enfants.</p>

      <div className="mt-6">
        <NotificationForm
          canalInitial={preference?.canal ?? "SMS"}
          frequenceInitiale={preference?.frequence ?? "HEBDOMADAIRE"}
        />
      </div>
    </main>
  );
}
