import { NextResponse } from "next/server";
import { z } from "zod";
import { exigerRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { CLE_PRIX_NORMAL_PREMIUM, periodeTarifaireActive } from "@/lib/payment/tarification";

/**
 * Modification du prix Premium normal (hors promo, §2.4.1) — réservé ADMIN
 * (contrôle de rôle ici, comme pour `periodes-tarifaires` : le middleware ne
 * couvre pas `/api/*`). Un seul paramètre, stocké dans `ParametrePlateforme`
 * (clé `PRIX_NORMAL_PREMIUM`) plutôt qu'une table dédiée — upsert simple,
 * pas de notion d'id côté client.
 */
const bodySchema = z.object({
  prix: z.coerce.number().positive().max(1_000_000),
});

export async function PUT(request: Request) {
  const garde = await exigerRole("ADMIN");
  if (!garde.ok) return garde.response;
  const session = garde.session;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }
  const { prix } = parsed.data;

  const admin = await prisma.admin.findUnique({ where: { id: session.user.id }, select: { id: true } });
  if (!admin) {
    return NextResponse.json({ error: "Compte admin introuvable." }, { status: 400 });
  }

  await prisma.parametrePlateforme.upsert({
    where: { cle: CLE_PRIX_NORMAL_PREMIUM },
    update: { valeur: String(prix), modifieParAdminId: admin.id },
    create: { cle: CLE_PRIX_NORMAL_PREMIUM, valeur: String(prix), modifieParAdminId: admin.id },
  });

  // Cohérence non bloquante (point 4 de la demande) : un prix normal devenu
  // inférieur au prix d'une fenêtre promo actuellement active n'a plus rien
  // d'une "réduction" — signalé à l'admin, mais assumé comme un choix possible
  // (ex. déclassement temporaire) plutôt que rejeté.
  const promoActive = await periodeTarifaireActive();
  const avertissement =
    promoActive && prix < promoActive.prix
      ? `Attention : ce prix (${prix.toLocaleString("fr-FR")} FCFA) est inférieur à celui de la fenêtre promo ` +
        `actuellement active « ${promoActive.nom} » (${promoActive.prix.toLocaleString("fr-FR")} FCFA) — elle ne ` +
        `constitue plus une réduction.`
      : undefined;

  return NextResponse.json({ parametre: { prixNormal: prix }, avertissement });
}
