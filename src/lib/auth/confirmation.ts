import { prisma } from "@/lib/prisma";
import { verifyPin, PIN_MAX_ATTEMPTS, PIN_LOCKOUT_MINUTES } from "@/lib/auth/pin";

/**
 * Re-vérification légère avant validation finale d'un paiement (§2.6, §5.4 —
 * renforcement au-delà du minimum spécifié, demandé explicitement par
 * l'utilisateur : "même principe qu'une banque qui redemande un code avant
 * un virement, même si la session est déjà active"). **Uniquement pour un
 * élève payeur** — un parent a déjà franchi une vérification forte à la
 * connexion (OTP SMS, §2.2) et n'a pas besoin d'en repasser une pour payer.
 * Confirme uniquement que la personne qui valide est bien celle qui connaît
 * le PIN du compte — ne crée ni ne modifie aucune session/token NextAuth, et
 * ne partage pas de code avec `src/auth.ts` (le mécanisme reste isolé à
 * l'étape paiement, pour ne jamais risquer une régression sur la connexion
 * elle-même).
 *
 * Réutilise volontairement les mêmes compteurs que la connexion
 * (`Eleve.pinTentativesEchouees`/`pinVerrouilleJusqua`) — un blocage ici
 * verrouille aussi la connexion, comportement voulu (§7 : le rate limiting
 * protège le compte, pas une action isolée).
 */

export type ResultatConfirmation = { ok: true } | { ok: false; error: string; status: 401 | 404 | 423 };

export async function verifierPinConfirmation(eleveId: string, pin: string): Promise<ResultatConfirmation> {
  const eleve = await prisma.eleve.findUnique({
    where: { id: eleveId },
    select: { pinHash: true, pinTentativesEchouees: true, pinVerrouilleJusqua: true },
  });
  if (!eleve) {
    return { ok: false, error: "Compte introuvable.", status: 404 };
  }

  if (eleve.pinVerrouilleJusqua && eleve.pinVerrouilleJusqua > new Date()) {
    const minutes = Math.ceil((eleve.pinVerrouilleJusqua.getTime() - Date.now()) / 60_000);
    return { ok: false, error: `Trop de tentatives incorrectes. Réessaie dans ${minutes} min.`, status: 423 };
  }

  const valide = await verifyPin(pin, eleve.pinHash);
  if (!valide) {
    const tentatives = eleve.pinTentativesEchouees + 1;
    const verrouille = tentatives >= PIN_MAX_ATTEMPTS;
    await prisma.eleve.update({
      where: { id: eleveId },
      data: {
        pinTentativesEchouees: tentatives,
        pinVerrouilleJusqua: verrouille ? new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60_000) : null,
      },
    });
    await prisma.auditLogSecurite.create({ data: { typeEvenement: "PIN_FAIL", utilisateurId: eleveId } });
    return verrouille
      ? { ok: false, error: `Trop de tentatives incorrectes. Réessaie dans ${PIN_LOCKOUT_MINUTES} min.`, status: 423 }
      : {
          ok: false,
          error: `Code secret incorrect (${PIN_MAX_ATTEMPTS - tentatives} tentative${PIN_MAX_ATTEMPTS - tentatives > 1 ? "s" : ""} restante${PIN_MAX_ATTEMPTS - tentatives > 1 ? "s" : ""}).`,
          status: 401,
        };
  }

  await prisma.eleve.update({ where: { id: eleveId }, data: { pinTentativesEchouees: 0, pinVerrouilleJusqua: null } });
  return { ok: true };
}
