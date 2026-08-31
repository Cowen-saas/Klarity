import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { obtenirTarifPremium } from "@/lib/payment/tarification";
import { IconCheckCircle, IconLock } from "@/components/icons";

const LABEL_PERIODE: Record<string, string> = {
  NOEL: "🎁 Offre de Noël — Décembre à Février",
  PAQUES: "🐣 Offre de Pâques — Avril à Juin",
  NORMALE: "",
};

const CLASSE_LABELS: Record<string, string> = {
  TROISIEME: "3e",
  PREMIERE: "1ère",
  TERMINALE: "Terminale",
};

const LIGNES_COMPARATIF: Array<{ label: string; gratuit: string; premium: string }> = [
  { label: "Épreuves", gratuit: "2 par matière", premium: "Illimitées" },
  { label: "Vidéos pédagogiques", gratuit: "—", premium: "Illimitées" },
  { label: "Quiz", gratuit: "Limités (2/jour)", premium: "Illimités" },
  { label: "Exercices quotidiens", gratuit: "Limités (2/jour)", premium: "Illimités" },
  { label: "Correction IA", gratuit: "✓", premium: "✓" },
  { label: "Détection des lacunes", gratuit: "✓", premium: "✓" },
  { label: "Recommandations personnalisées", gratuit: "—", premium: "✓" },
  { label: "Suivi avancé de progression", gratuit: "—", premium: "✓" },
];

export default async function AbonnementPage({ searchParams }: PageProps<"/abonnement">) {
  const session = await auth();
  // Le layout parent redirige déjà si non authentifié / mauvais rôle.
  if (!session) return null;

  let eleveId: string;
  let selecteurEnfants: { liens: Array<{ id: string; nom: string; classe: string; filiere: string | null }>; selectedId: string } | null = null;

  if (session.user.role === "PARENT") {
    const [liens, parent] = await Promise.all([
      prisma.parentEleveLink.findMany({
        where: { parentId: session.user.id },
        include: { eleve: { select: { id: true, nom: true, classe: true, filiere: true } } },
        orderBy: { dateLiaison: "asc" },
      }),
      prisma.parent.findUnique({ where: { id: session.user.id }, select: { dernierEleveConsulteId: true } }),
    ]);
    if (liens.length === 0) {
      return (
        <div className="mx-auto max-w-2xl rounded-3xl bg-surface p-10 text-center shadow-sm">
          <h1 className="text-xl font-bold text-texte">Aucun enfant lié pour l&apos;instant</h1>
          <p className="mt-2 text-sm text-texte-muted">
            Lie d&apos;abord un enfant depuis ton tableau de bord pour pouvoir gérer son abonnement.
          </p>
        </div>
      );
    }
    const { eleve: eleveParam } = await searchParams;
    const idParam = Array.isArray(eleveParam) ? eleveParam[0] : eleveParam;
    const idsLies = new Set(liens.map((l) => l.eleveId));
    eleveId =
      idParam && idsLies.has(idParam)
        ? idParam
        : parent?.dernierEleveConsulteId && idsLies.has(parent.dernierEleveConsulteId)
          ? parent.dernierEleveConsulteId
          : liens[0].eleveId;
    selecteurEnfants = {
      liens: liens.map((l) => ({ id: l.eleveId, nom: l.eleve.nom, classe: l.eleve.classe, filiere: l.eleve.filiere })),
      selectedId: eleveId,
    };
  } else {
    eleveId = session.user.id;
  }

  const abonnement = await prisma.abonnement.findFirst({ where: { eleveId }, orderBy: { dateDebut: "desc" } });
  const dejaPremiumActif = abonnement?.plan === "PREMIUM" && abonnement.statut === "ACTIF";
  const tarif = obtenirTarifPremium(new Date());
  const pourcentageReduction = Math.round((tarif.reduction / tarif.prixNormal) * 100);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-3xl bg-surface p-6 shadow-sm sm:p-10">
        {selecteurEnfants && selecteurEnfants.liens.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {selecteurEnfants.liens.map((enfant) => (
              <Link
                key={enfant.id}
                href={`/abonnement?eleve=${enfant.id}`}
                className={`rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors ${
                  enfant.id === selecteurEnfants!.selectedId
                    ? "border-primary bg-primary-light text-primary"
                    : "border-border bg-surface text-texte"
                }`}
              >
                {enfant.nom} · {CLASSE_LABELS[enfant.classe] ?? enfant.classe}
                {enfant.filiere ? ` ${enfant.filiere}` : ""}
              </Link>
            ))}
          </div>
        )}

        <div className="text-center">
          {tarif.periode !== "NORMALE" && (
            <span className="inline-block rounded-full bg-danger-light px-4 py-1.5 text-xs font-bold text-danger">
              {LABEL_PERIODE[tarif.periode]}
            </span>
          )}
          <h1 className="mt-4 text-2xl font-bold text-texte sm:text-3xl">Choisissez votre formule</h1>
          <p className="mt-2 text-sm text-texte-muted">Changez ou annulez à tout moment.</p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl border-2 border-border p-6">
            <p className="text-sm font-bold text-texte">Gratuit</p>
            <p className="mt-2">
              <span className="font-serif text-3xl font-bold text-texte">0 FCFA</span>
              <span className="text-sm text-texte-muted"> /mois</span>
            </p>
            <ul className="mt-6 space-y-3 text-sm text-texte">
              <li>✓ 2 épreuves par matière</li>
              <li>✓ Correction IA &amp; détection des lacunes</li>
              <li>✓ Quiz &amp; exercices limités à 2/jour</li>
              <li className="flex items-center gap-1.5 text-texte-muted">
                <IconLock className="h-3.5 w-3.5" aria-hidden="true" /> Pas de vidéos explicatives
              </li>
            </ul>
            {!abonnement || abonnement.plan === "GRATUIT" ? (
              <span className="mt-8 block rounded-xl border-2 border-border py-3 text-center text-sm font-semibold text-texte-muted">
                Formule actuelle
              </span>
            ) : (
              <Link
                href={session.user.role === "PARENT" ? `/parent?eleve=${eleveId}` : "/eleve"}
                className="mt-8 block rounded-xl border-2 border-border bg-surface py-3 text-center text-sm font-semibold text-texte transition-colors hover:border-primary/40"
              >
                Continuer gratuitement
              </Link>
            )}
          </div>

          <div className="relative rounded-2xl border-2 border-primary bg-primary-light p-6">
            <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
              Recommandé
            </span>
            {tarif.reduction > 0 && (
              <span className="absolute -top-3 right-6 rounded-full bg-danger px-2.5 py-1 text-[11px] font-bold text-white">
                -{pourcentageReduction}%
              </span>
            )}
            <p className="text-sm font-bold text-texte">Premium</p>
            <p className="mt-2">
              <span className="font-serif text-3xl font-bold text-texte">{tarif.prix.toLocaleString("fr-FR")} FCFA</span>
              <span className="text-sm text-texte-muted"> /mois</span>
            </p>
            {tarif.reduction > 0 && (
              <p className="text-sm text-texte-muted line-through">{tarif.prixNormal.toLocaleString("fr-FR")} FCFA / mois</p>
            )}
            <ul className="mt-6 space-y-3 text-sm text-texte">
              <li>✓ Épreuves illimitées</li>
              <li>✓ Vidéos explicatives illimitées</li>
              <li>✓ Correction IA des épreuves</li>
              <li>✓ Détection des lacunes + recommandations</li>
              <li>✓ Suivi avancé de progression</li>
            </ul>
            {dejaPremiumActif ? (
              <span className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white">
                <IconCheckCircle className="h-4 w-4" weight="fill" aria-hidden="true" /> Premium actif
              </span>
            ) : (
              <Link
                href={`/abonnement/paiement?eleve=${eleveId}`}
                className="mt-8 block rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                Choisir Premium
              </Link>
            )}
          </div>
        </div>

        <h2 className="mt-10 text-center text-lg font-bold text-texte">Comparer les fonctionnalités</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="bg-fond text-xs font-bold tracking-wide text-texte-muted uppercase">
                <th className="px-4 py-3">Fonctionnalité</th>
                <th className="px-4 py-3">Gratuit</th>
                <th className="px-4 py-3">Premium</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {LIGNES_COMPARATIF.map((ligne) => (
                <tr key={ligne.label}>
                  <td className="px-4 py-3 font-semibold text-texte">{ligne.label}</td>
                  <td className="px-4 py-3 text-texte-muted">{ligne.gratuit}</td>
                  <td className="px-4 py-3 font-semibold text-texte">{ligne.premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
