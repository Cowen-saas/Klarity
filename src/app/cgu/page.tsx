import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { cguMeta, cguBlocks } from "@/content/legal/cgu";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — Klarity",
};

export default function CguPage() {
  return (
    <main>
      <LandingHeader />
      <LegalDocument meta={cguMeta} blocks={cguBlocks} />
      <LandingFooter />
    </main>
  );
}
