import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPaymentProvider } from "@/lib/payment";
import { obtenirTarifPremium, DEVISE_DEFAUT } from "@/lib/payment/tarification";
import { planifierWebhookMock } from "@/lib/queue/paiement";

/**
 * Initie un paiement Mobile Money pour passer un élève en Premium (§2.4, §2.6).
 * Accessible depuis l'espace élève (paiement de soi-même) et l'espace parent
 * (paiement pour un enfant lié) — c'est l'exception explicite du §2.6 à la
 * règle générale du §2.2 excluant toute action de gestion côté parent.
 */

const bodySchema = z.object({
  eleveId: z.string().min(1).optional(), // requis si l'appelant est PARENT (§2.6)
  operateur: z.enum(["ORANGE", "MTN"]),
  telephone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .transform((v) => (v.startsWith("237") ? v.slice(3) : v))
    .refine((v) => /^6\d{8}$/.test(v), "Numéro Mobile Money camerounais invalide (9 chiffres, commence par 6)."),
});

const LIMIT = 10;
const WINDOW_SECONDS = 60 * 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.error || (session.user.role !== "ELEVE" && session.user.role !== "PARENT")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }
  const { operateur, telephone } = parsed.data;

  let eleveId: string;
  const payeurRole: "PARENT" | "ELEVE" = session.user.role === "PARENT" ? "PARENT" : "ELEVE";

  if (session.user.role === "PARENT") {
    if (!parsed.data.eleveId) {
      return NextResponse.json({ error: "Choisis l'enfant concerné." }, { status: 400 });
    }
    const lien = await prisma.parentEleveLink.findUnique({
      where: { parentId_eleveId: { parentId: session.user.id, eleveId: parsed.data.eleveId } },
      select: { id: true },
    });
    if (!lien) {
      // Tentative réelle de payer pour un élève non lié — pas un simple ID inexistant.
      await prisma.auditLogSecurite.create({
        data: { typeEvenement: "IDOR_BLOCKED", utilisateurId: session.user.id, details: { eleveId: parsed.data.eleveId } },
      });
      return NextResponse.json({ error: "Cet élève n'est pas lié à ton compte." }, { status: 403 });
    }
    eleveId = parsed.data.eleveId;
  } else {
    eleveId = session.user.id;
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const [okIp, okEleve] = await Promise.all([
    checkRateLimit(`paiement:ip:${ip}`, LIMIT, WINDOW_SECONDS),
    checkRateLimit(`paiement:eleve:${eleveId}`, LIMIT, WINDOW_SECONDS),
  ]);
  if (!okIp || !okEleve) {
    return NextResponse.json({ error: "Trop de tentatives, réessaie plus tard." }, { status: 429 });
  }

  let abonnement = await prisma.abonnement.findFirst({ where: { eleveId }, orderBy: { dateDebut: "desc" } });
  if (abonnement && abonnement.plan === "PREMIUM" && abonnement.statut === "ACTIF") {
    return NextResponse.json({ error: "Cet élève a déjà un abonnement Premium actif." }, { status: 409 });
  }
  if (!abonnement) {
    abonnement = await prisma.abonnement.create({ data: { eleveId } });
  }

  const tarif = obtenirTarifPremium(new Date());
  const telephoneFormate = `+237${telephone}`;

  const provider = getPaymentProvider();
  const paiementSession = await provider.initierPaiement(tarif.prix, DEVISE_DEFAUT, "MOBILE_MONEY", {
    telephone: telephoneFormate,
    role: payeurRole,
  });

  const paiement = await prisma.paiement.create({
    data: {
      abonnementId: abonnement.id,
      payeurTelephone: telephoneFormate,
      payeurRole,
      montant: tarif.prix,
      devise: DEVISE_DEFAUT,
      methode: "MOBILE_MONEY",
      statut: paiementSession.statut,
      referenceCamerPay: `PENDING-${paiementSession.sessionId}`,
      idempotencyKey: paiementSession.sessionId,
    },
  });

  // Convention de test en mode mock (§5.2) : un numéro se terminant par 0
  // simule un ECHEC, tout autre numéro simule un REUSSI — permet de tester les
  // deux chemins de l'écran de vérification (§17) sans dépendance CamerPay.
  if ((process.env.PAYMENT_MODE ?? "mock") === "mock") {
    const statutCible = telephone.endsWith("0") ? "ECHEC" : "REUSSI";
    await planifierWebhookMock({
      sessionId: paiementSession.sessionId,
      statutCible,
      montant: tarif.prix,
      devise: DEVISE_DEFAUT,
    });
  }

  return NextResponse.json(
    {
      paiementId: paiement.id,
      montant: tarif.prix,
      devise: DEVISE_DEFAUT,
      periode: tarif.periode,
      indiceDevMock:
        process.env.NODE_ENV !== "production"
          ? "Mode simulation : un numéro se terminant par 0 échoue, tout autre numéro réussit."
          : undefined,
    },
    { status: 201 }
  );
}
