import Link from "next/link";
import { IconGraduationCap, IconUsers } from "@/components/icons";

/**
 * Étape intermédiaire pour un visiteur non connecté qui clique "Choisir
 * Premium" (§2.2, §2.6) — un simple redirect générique vers /connexion ne
 * suffit pas ici : contrairement à l'élève, le parent n'a pas de compte
 * autonome (§2.2 du CDC, "un parent ne peut se connecter qu'avec le code
 * élève + téléphone de son enfant"), donc l'écran doit distinguer les deux
 * parcours avant d'envoyer vers /connexion. Reste public (pas de session
 * requise) — c'est un simple aiguillage, pas une étape de paiement.
 */
const DESTINATION = "/abonnement/paiement";

export default function EleveOuParentPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-3xl bg-surface p-6 shadow-sm sm:p-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-texte sm:text-3xl">Comment veux-tu continuer ?</h1>
          <p className="mt-2 text-sm text-texte-muted">
            Il nous faut un compte pour associer ton abonnement Premium.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex flex-col rounded-2xl border-2 border-border p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary">
              <IconGraduationCap className="h-6 w-6" weight="fill" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-base font-bold text-texte">Je suis élève</h2>
            <p className="mt-1 text-sm text-texte-muted">Connecte-toi avec ton code élève et ton code secret.</p>
            <Link
              href={`/connexion?from=${DESTINATION}&role=ELEVE`}
              className="mt-6 block rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Se connecter
            </Link>
            <Link
              href="/inscription"
              className="mt-3 block text-center text-sm font-semibold text-primary hover:underline"
            >
              Pas encore de compte ? Créer un compte
            </Link>
          </div>

          <div className="flex flex-col rounded-2xl border-2 border-border p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary">
              <IconUsers className="h-6 w-6" weight="fill" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-base font-bold text-texte">Je suis parent</h2>
            <p className="mt-1 text-sm text-texte-muted">
              La connexion se fait avec le code élève transmis par ton enfant, puis un code reçu par SMS — tu n&apos;as
              pas de compte autonome à créer.
            </p>
            <Link
              href={`/connexion?from=${DESTINATION}&role=PARENT`}
              className="mt-6 block rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Se connecter
            </Link>
            <Link
              href="/inscription"
              className="mt-3 block text-center text-sm font-semibold text-primary hover:underline"
            >
              Ton enfant n&apos;a pas encore de compte ?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
