import type { Metadata } from "next";
import { Sora, IBM_Plex_Serif } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const plexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-plex-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Klarity",
  description: "Plateforme éducative IA — 3ème, 1ère, Terminale (Cameroun)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${sora.variable} ${plexSerif.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
