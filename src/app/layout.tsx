import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Klarity",
  description: "Plateforme éducative IA — 3ème, 1ère, Terminale (Cameroun)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
