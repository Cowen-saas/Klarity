import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { mentionsLegalesMeta, mentionsLegalesBlocks } from "@/content/legal/mentions-legales";

export const metadata: Metadata = {
  title: "Mentions légales — Klarity",
};

export default function MentionsLegalesPage() {
  return (
    <main>
      <LandingHeader />
      <LegalDocument meta={mentionsLegalesMeta} blocks={mentionsLegalesBlocks} />
      <LandingFooter />
    </main>
  );
}
