import bcrypt from "bcryptjs";
import { generateSecret } from "otplib";
import { prisma } from "../src/lib/prisma";

/**
 * Création d'un compte Admin (§4.1 CDC) — script CLI uniquement, jamais une
 * route HTTP. C'est le seul moyen de créer un compte admin dans l'app :
 * aucune route d'inscription/self-service n'existe, par design.
 *
 * Usage : tsx prisma/create-admin.ts <email> <mot-de-passe> [SUPERADMIN|ADMIN]
 * (ou : npm run admin:create -- <email> <mot-de-passe> [rôle])
 */

const MOT_DE_PASSE_LONGUEUR_MIN = 12;

function afficherUsageEtQuitter(message?: string): never {
  if (message) console.error(`Erreur : ${message}\n`);
  console.error(
    "Usage : tsx prisma/create-admin.ts <email> <mot-de-passe> [SUPERADMIN|ADMIN]\n" +
      "  - Le mot de passe doit faire au moins 12 caractères.\n" +
      "  - Rôle par défaut : SUPERADMIN.\n" +
      "  - Ce script ne réécrase jamais un compte existant (relance-le avec un autre email, ou\n" +
      "    modifie le compte directement en base si tu dois vraiment le remplacer)."
  );
  process.exit(1);
}

async function main() {
  const [, , email, motDePasse, roleArg] = process.argv;

  if (!email || !motDePasse) afficherUsageEtQuitter("email et mot de passe requis.");
  if (motDePasse.length < MOT_DE_PASSE_LONGUEUR_MIN) {
    afficherUsageEtQuitter(`le mot de passe doit faire au moins ${MOT_DE_PASSE_LONGUEUR_MIN} caractères.`);
  }
  if (roleArg && roleArg !== "ADMIN" && roleArg !== "SUPERADMIN") {
    afficherUsageEtQuitter(`rôle invalide "${roleArg}" — attendu SUPERADMIN ou ADMIN.`);
  }
  const role = roleArg === "ADMIN" ? "ADMIN" : "SUPERADMIN";

  const existant = await prisma.admin.findUnique({ where: { email } });
  if (existant) {
    afficherUsageEtQuitter(`un compte admin existe déjà pour ${email} — ce script ne réécrase jamais un compte existant.`);
  }

  const motDePasseHash = await bcrypt.hash(motDePasse, 12);
  const twoFactorSecret = generateSecret();

  const admin = await prisma.admin.create({ data: { email, motDePasseHash, twoFactorSecret, role } });

  const otpauthUri = `otpauth://totp/Klarity:${encodeURIComponent(email)}?secret=${twoFactorSecret}&issuer=Klarity`;

  console.log("\n✅ Compte admin créé.\n");
  console.log(`Email : ${admin.email}`);
  console.log(`Rôle  : ${admin.role}`);
  console.log("\nSecret 2FA — à ajouter MAINTENANT dans ton application d'authentification");
  console.log("(Google Authenticator, Authy, ...). Il n'est jamais réaffiché ni stocké en clair ailleurs :\n");
  console.log(`  ${twoFactorSecret}`);
  console.log("\nOu colle cette URI dans un générateur de QR code pour scanner directement :\n");
  console.log(`  ${otpauthUri}\n`);
}

main()
  .catch((err) => {
    console.error("[create-admin] échec :", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
