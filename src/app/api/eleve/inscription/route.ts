import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { genererCodeEleveUnique } from "@/lib/auth/code-eleve";
import { hashPin } from "@/lib/auth/pin";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Inscription élève (§2.1) : nom + classe + filière (Première/Terminale
 * uniquement) → code ELE-XXX-XXX + PIN. Pas de lien parent ici — établi a
 * posteriori via OTP (`/api/auth/parent/request-otp`, cf. `auth.ts`).
 */
const bodySchema = z
  .object({
    nom: z.string().trim().min(2, "Nom trop court.").max(80, "Nom trop long."),
    classe: z.enum(["TROISIEME", "PREMIERE", "TERMINALE"]),
    filiere: z.enum(["A", "C", "D", "TI"]).optional(),
    pin: z.string().regex(/^\d{4}$/, "Le code secret doit contenir 4 chiffres."),
  })
  .refine((data) => (data.classe === "TROISIEME" ? data.filiere === undefined : data.filiere !== undefined), {
    message: "La filière est requise pour Première/Terminale, absente en 3ème.",
    path: ["filiere"],
  });

const LIMIT = 10;
const WINDOW_SECONDS = 60 * 60;

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const okIp = await checkRateLimit(`inscription:ip:${ip}`, LIMIT, WINDOW_SECONDS);
  if (!okIp) {
    return NextResponse.json({ error: "Trop de tentatives, réessayez plus tard." }, { status: 429 });
  }

  const { nom, classe, filiere, pin } = parsed.data;
  const [codeEleve, pinHash] = await Promise.all([genererCodeEleveUnique(), hashPin(pin)]);

  try {
    const eleve = await prisma.eleve.create({
      data: { nom, classe, filiere, pinHash, codeEleve },
      select: { codeEleve: true },
    });
    return NextResponse.json({ codeEleve: eleve.codeEleve }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Conflit lors de la génération du code, réessaie." }, { status: 409 });
    }
    throw err;
  }
}
