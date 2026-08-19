import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyPin, PIN_MAX_ATTEMPTS, PIN_LOCKOUT_MINUTES } from "@/lib/auth/pin";
import { verifyOtp } from "@/lib/auth/otp";
import { verifyTotp } from "@/lib/auth/totp";
import type { ActeurRole } from "@/types/next-auth";

/**
 * Auth.js v5, JWT stateless, 3 rôles (§2.7, §4.1, §7) : access token à durée de
 * vie courte, refresh token long avec rotation — jamais l'inverse (précision
 * v1.17). Implémentation sans table de session : le cookie JWT chiffré de
 * NextAuth *est* le refresh token (durée = REFRESH_TOKEN_TTL_SECONDS) ; à
 * chaque requête, le callback jwt() ne reconduit un nouvel access token
 * (accessTokenExpires, courte durée) que si le compte est toujours valide en
 * base — c'est le seul point de contrôle possible sur un JWT sans état, et il
 * couvre la révocation (compte anonymisé/verrouillé) sans jamais stocker de
 * session serveur (cf. réf. sécurité §2, "jamais de session en mémoire locale").
 */

const ACCESS_TOKEN_TTL_MS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900) * 1000;
const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 2_592_000);

async function compteToujoursValide(role: ActeurRole, id: string): Promise<boolean> {
  switch (role) {
    case "ELEVE": {
      const eleve = await prisma.eleve.findUnique({ where: { id } });
      return !!eleve && eleve.statutCompte === "ACTIF";
    }
    case "PARENT": {
      const parent = await prisma.parent.findUnique({ where: { id } });
      return !!parent;
    }
    case "ADMIN": {
      const admin = await prisma.admin.findUnique({ where: { id } });
      return !!admin;
    }
    default:
      return false;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: REFRESH_TOKEN_TTL_SECONDS },
  trustHost: true,
  pages: { signIn: "/connexion" },

  providers: [
    /**
     * Élève : codeEleve + PIN à 4 chiffres (§2.7). L'inscription (qui fixe le
     * PIN initial) est un flux séparé, hors scope Phase 0 — cf. cahier des
     * charges §10, Phase 1.
     */
    Credentials({
      id: "eleve",
      name: "Élève",
      credentials: {
        codeEleve: { label: "Code élève", type: "text" },
        pin: { label: "PIN", type: "password" },
      },
      async authorize(credentials) {
        const codeEleve = credentials?.codeEleve as string | undefined;
        const pin = credentials?.pin as string | undefined;
        if (!codeEleve || !pin) return null;

        const eleve = await prisma.eleve.findUnique({ where: { codeEleve } });
        if (!eleve || eleve.statutCompte !== "ACTIF") return null;

        if (eleve.pinVerrouilleJusqua && eleve.pinVerrouilleJusqua > new Date()) {
          return null;
        }

        const valide = await verifyPin(pin, eleve.pinHash);
        if (!valide) {
          const tentatives = eleve.pinTentativesEchouees + 1;
          const verrouille = tentatives >= PIN_MAX_ATTEMPTS;
          await prisma.eleve.update({
            where: { id: eleve.id },
            data: {
              pinTentativesEchouees: tentatives,
              pinVerrouilleJusqua: verrouille
                ? new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60_000)
                : null,
            },
          });
          await prisma.auditLogSecurite.create({
            data: { typeEvenement: "PIN_FAIL", utilisateurId: eleve.id },
          });
          return null;
        }

        await prisma.eleve.update({
          where: { id: eleve.id },
          data: { pinTentativesEchouees: 0, pinVerrouilleJusqua: null, derniereActiviteLe: new Date() },
        });

        return {
          id: eleve.id,
          role: "ELEVE",
          codeEleve: eleve.codeEleve,
          classe: eleve.classe,
          filiere: eleve.filiere,
        };
      },
    }),

    /**
     * Parent : codeEleve + téléphone + OTP déjà envoyé via
     * /api/auth/parent/request-otp (§2.2, §2.7). Le ParentEleveLink est établi
     * ici, a posteriori, dès la première vérification OTP réussie (§1.2, §2.2).
     */
    Credentials({
      id: "parent",
      name: "Parent",
      credentials: {
        codeEleve: { label: "Code élève", type: "text" },
        telephone: { label: "Téléphone", type: "text" },
        otp: { label: "Code de vérification", type: "text" },
      },
      async authorize(credentials) {
        const codeEleve = credentials?.codeEleve as string | undefined;
        const telephone = credentials?.telephone as string | undefined;
        const otp = credentials?.otp as string | undefined;
        if (!codeEleve || !telephone || !otp) return null;

        const eleve = await prisma.eleve.findUnique({ where: { codeEleve } });
        if (!eleve) return null;

        const otpRow = await prisma.otpVerification.findFirst({
          where: { telephone, utilise: false },
          orderBy: { createdAt: "desc" },
        });
        if (!otpRow || otpRow.expiration < new Date() || otpRow.tentatives >= 5) return null;

        const valide = await verifyOtp(otp, otpRow.codeOtpHash);
        if (!valide) {
          await prisma.otpVerification.update({
            where: { id: otpRow.id },
            data: { tentatives: { increment: 1 } },
          });
          await prisma.auditLogSecurite.create({
            data: { typeEvenement: "OTP_FAIL", details: { telephone } },
          });
          return null;
        }

        await prisma.otpVerification.update({ where: { id: otpRow.id }, data: { utilise: true } });

        const parent = await prisma.parent.upsert({
          where: { telephone },
          update: { derniereConnexion: new Date() },
          create: { telephone, derniereConnexion: new Date() },
        });

        await prisma.parentEleveLink.upsert({
          where: { parentId_eleveId: { parentId: parent.id, eleveId: eleve.id } },
          update: {},
          create: { parentId: parent.id, eleveId: eleve.id, codeUtilise: codeEleve },
        });

        return { id: parent.id, role: "PARENT", telephone: parent.telephone };
      },
    }),

    /** Admin : email + mot de passe + 2FA TOTP obligatoire (§2.7, §4.1, §7). */
    Credentials({
      id: "admin",
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Mot de passe", type: "password" },
        totpCode: { label: "Code 2FA", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        const totpCode = credentials?.totpCode as string | undefined;
        if (!email || !password || !totpCode) return null;

        const admin = await prisma.admin.findUnique({ where: { email } });
        if (!admin) return null;

        const motDePasseValide = await bcrypt.compare(password, admin.motDePasseHash);
        const totpValide = motDePasseValide && (await verifyTotp(totpCode, admin.twoFactorSecret));
        if (!motDePasseValide || !totpValide) {
          await prisma.auditLogSecurite.create({
            data: { typeEvenement: "LOGIN_FAIL", utilisateurId: admin.id },
          });
          return null;
        }

        return { id: admin.id, role: "ADMIN", adminRole: admin.role, email: admin.email };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.adminRole = user.adminRole;
        token.codeEleve = user.codeEleve;
        token.classe = user.classe;
        token.filiere = user.filiere;
        token.telephone = user.telephone;
        token.email = user.email;
        token.accessTokenExpires = Date.now() + ACCESS_TOKEN_TTL_MS;
        delete token.error;
        return token;
      }

      if (typeof token.accessTokenExpires === "number" && Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Fenêtre d'access token expirée : rotation. Seul point de contrôle
      // possible sur un JWT stateless — permet à un compte anonymisé/verrouillé
      // de perdre l'accès sans table de session à révoquer.
      if (!token.role || !token.sub) {
        return { ...token, error: "RefreshFailed" };
      }
      const valide = await compteToujoursValide(token.role, token.sub);
      if (!valide) {
        return { ...token, error: "AccountInvalidated" };
      }
      return { ...token, accessTokenExpires: Date.now() + ACCESS_TOKEN_TTL_MS, error: undefined };
    },

    async session({ session, token }) {
      session.user.id = token.sub as string;
      session.user.role = token.role as ActeurRole;
      session.user.adminRole = token.adminRole;
      session.user.codeEleve = token.codeEleve;
      session.user.classe = token.classe;
      session.user.filiere = token.filiere;
      session.user.telephone = token.telephone;
      session.user.email = token.email;
      session.accessTokenExpires = token.accessTokenExpires;
      if (token.error) session.error = token.error;
      return session;
    },
  },
});
