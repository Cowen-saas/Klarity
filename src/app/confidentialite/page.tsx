import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { politiqueConfidentialiteMeta, politiqueConfidentialiteBlocks } from "@/content/legal/confidentialite";

export const metadata: Metadata = {
  title: "Politique de Confidentialité — Klarity",
};

export default function ConfidentialitePage() {
  return (
    <main>
      <LandingHeader />
      <LegalDocument meta={politiqueConfidentialiteMeta} blocks={politiqueConfidentialiteBlocks} />
      <LandingFooter />
    </main>
  );
}
