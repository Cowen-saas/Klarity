import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { lireFichierSigneMock } from "@/lib/storage/mock-provider";

/**
 * Sert un fichier du `MockStorageProvider` à partir d'une URL signée (générée
 * par `obtenirUrlSignee`). Vérifie HMAC + échéance comme le ferait R2. Gate
 * ADMIN en plus : en dev, seuls les écrans admin consomment ces URLs (les
 * élèves ne téléchargent encore aucune épreuve). Quand R2 réel sera branché,
 * cette route disparaît — R2 sert directement ses URLs signées.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const exp = url.searchParams.get("exp");
  const sig = url.searchParams.get("sig");
  if (!key || !exp || !sig) {
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  }

  const resultat = await lireFichierSigneMock(key, exp, sig);
  if ("erreur" in resultat) {
    const status = resultat.erreur === "introuvable" ? 404 : 403;
    return NextResponse.json({ error: `URL ${resultat.erreur}.` }, { status });
  }

  const contentType = key.endsWith(".pdf")
    ? "application/pdf"
    : key.endsWith(".png")
      ? "image/png"
      : key.endsWith(".webp")
        ? "image/webp"
        : key.endsWith(".jpg")
          ? "image/jpeg"
          : "application/octet-stream";

  return new NextResponse(new Uint8Array(resultat.contenu), {
    headers: { "Content-Type": contentType, "Content-Disposition": "inline", "Cache-Control": "private, max-age=0" },
  });
}
