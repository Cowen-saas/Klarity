import type { Metadata } from "next";
import { ChatPanel } from "@/components/tuteur-ia/ChatPanel";

export const metadata: Metadata = {
  title: "Tuteur IA — Klarity",
};

export default function TuteurIaPage() {
  return (
    <main className="px-6 py-4 sm:px-8 sm:py-8">
      <ChatPanel />
    </main>
  );
}
