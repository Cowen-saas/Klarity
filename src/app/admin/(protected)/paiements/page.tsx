import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { Prisma, StatutPaiement, MethodePaiement } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { IconCreditCard } from "@/components/icons";
import { Pagination, lirePage } from "@/components/admin/Pagination";
import { BandeauModeTest } from "@/components/admin/BandeauModeTest";
import { paiementsSontReels } from "@/lib/payment";

export const metadata: Metadata = {
  title: "Paiements — Admin Klarity",
  robots: { index: false, follow: false },
};

const PAR_PAGE = 20;

const STATUTS: { value: StatutPaiement; label: string; classes: string }[] = [
  { value: "REUSSI", label: "Confirmé", classes: "bg-success-light text-success" },
  { value: "EN_ATTENTE", label: "En attente", classes: "bg-accent-light text-texte" },
  { value: "ECHEC", label: "Échoué", classes: "bg-danger-light text-danger" },
  { value: "REMBOURSE", label: "Remboursé", classes: "bg-fond text-texte-muted" },
];
const STATUT_MAP = new Map(STATUTS.map((s) => [s.value, s]));

const METHODES: { value: MethodePaiement; label: string }[] = [{ value: "MOBILE_MONEY", label: "Mobile Money" }];

const PERIODES: { value: string; label: string; jours: number | null }[] = [
  { value: "tout", label: "Tout", jours: null },
  { value: "30j", label: "30 j", jours: 30 },
  { value: "7j", label: "7 j", jours: 7 },
];

function estStatut(v: string | undefined): v is StatutPaiement {
  return v !== undefined && STATUT_MAP.has(v as StatutPaiement);
}
function estMethode(v: string | undefined): v is MethodePaiement {
  return v === "MOBILE_MONEY";
}

/** Masque un numéro : garde l'indicatif et les 2 derniers chiffres. */
function telMasque(tel: string): string {
  if (tel.length <= 4) return tel;
  const debut = tel.startsWith("+") ? tel.slice(0, 4) : tel.slice(0, 3);
  return `${debut} •••• ${tel.slice(-2)}`;
}

function formatFCFA(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

/**
 * Journal des paiements (§2.3 — « Admin manages … platform financials »).
 * L'admin a un accès **global** légitime à toutes les lignes financières : pas
 * de restriction par élève ici (l'helper `chargerPaiementAutorise` d'IDOR, lui,
 * ne sert qu'au self-service élève/parent et refuse explicitement l'admin). La
 * défense repose sur le gate ADMIN (middleware + layout + ce contrôle en tête).
 * Aucune donnée carte n'existe (Mobile Money uniquement, §5) ; le téléphone
 * payeur est masqué, `referenceCamerPay` / `idempotencyKey` restent visibles
 * car nécessaires à la réconciliation.
 */
export default async function AdminPaiementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; statut?: string; methode?: string; periode?: string; paiement?: string }>;
}) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    redirect("/admin/connexion");
  }

  const modePaiement = process.env.PAYMENT_MODE ?? "mock";
  const { page: pageParam, statut: statutParam, methode: methodeParam, periode: periodeParam, paiement: paiementId } =
    await searchParams;

  const statutFiltre = estStatut(statutParam) ? statutParam : undefined;
  const methodeFiltre = estMethode(methodeParam) ? methodeParam : undefined;
  const periode = PERIODES.find((p) => p.value === periodeParam) ?? PERIODES[0];

  const where: Prisma.PaiementWhereInput = {};
  if (statutFiltre) where.statut = statutFiltre;
  if (methodeFiltre) where.methode = methodeFiltre;
  if (periode.jours !== null) {
    where.datePaiement = { gte: new Date(Date.now() - periode.jours * 24 * 60 * 60 * 1000) };
  }

  const baseParams = {
    statut: statutFiltre,
    methode: methodeFiltre,
    periode: periode.value === "tout" ? undefined : periode.value,
  };

  const [total, totauxStatut, montantEncaisse] = await Promise.all([
    prisma.paiement.count({ where }),
    prisma.paiement.groupBy({ by: ["statut"], _count: { _all: true } }),
    prisma.paiement.aggregate({ where: { statut: "REUSSI" }, _sum: { montant: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const page = lirePage(pageParam, totalPages);

  const paiements = await prisma.paiement.findMany({
    where,
    orderBy: { datePaiement: "desc" },
    skip: (page - 1) * PAR_PAGE,
    take: PAR_PAGE,
    select: {
      id: true,
      payeurRole: true,
      payeurTelephone: true,
      montant: true,
      devise: true,
      methode: true,
      statut: true,
      referenceCamerPay: true,
      idempotencyKey: true,
      datePaiement: true,
      abonnement: { select: { plan: true, eleve: { select: { codeEleve: true } } } },
    },
  });

  const comptesStatut = new Map(totauxStatut.map((r) => [r.statut, r._count._all]));
  const nbReussis = comptesStatut.get("REUSSI") ?? 0;
  const nbEchoues = comptesStatut.get("ECHEC") ?? 0;
  const totalGlobal = [...comptesStatut.values()].reduce((s, n) => s + n, 0);

  // Détail d'un paiement + webhooks correspondants (liés par
  // payloadBrut.sessionId == idempotencyKey — pas de FK directe).
  const detail = paiementId
    ? await prisma.paiement.findUnique({
        where: { id: paiementId },
        select: {
          id: true,
          payeurRole: true,
          payeurTelephone: true,
          montant: true,
          devise: true,
          methode: true,
          statut: true,
          referenceCamerPay: true,
          idempotencyKey: true,
          datePaiement: true,
          abonnement: {
            select: { id: true, plan: true, statut: true, prixApplique: true, eleve: { select: { codeEleve: true } } },
          },
        },
      })
    : null;

  const webhooksLies = detail
    ? await prisma.webhookLog.findMany({
        where: { payloadBrut: { path: ["sessionId"], equals: detail.idempotencyKey } },
        orderBy: { createdAt: "asc" },
        select: { id: true, provider: true, signatureValide: true, traitementStatut: true, createdAt: true },
      })
    : [];

  return (
    <main className="max-w-6xl px-6 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-texte">Paiements</h1>
      <p className="mt-1 text-sm text-texte-muted">
        Journal des transactions Mobile Money (§2.6, §5). Chaque webhook est vérifié par signature HMAC + clé
        d&apos;idempotence avant d&apos;être crédité.
      </p>

      {!paiementsSontReels() && <BandeauModeTest mode={modePaiement} sujet="Montants" />}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <PaiementTile label="Transactions" valeur={totalGlobal.toLocaleString("fr-FR")} />
        <PaiementTile label="Confirmées" valeur={nbReussis.toLocaleString("fr-FR")} />
        <PaiementTile label="Échouées" valeur={nbEchoues.toLocaleString("fr-FR")} />
        <PaiementTile label="Montant encaissé" valeur={formatFCFA(Number(montantEncaisse._sum.montant ?? 0))} />
      </div>

      <section className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-texte">Journal</h2>
          <span className="text-xs text-texte-muted">
            {total.toLocaleString("fr-FR")} transaction{total > 1 ? "s" : ""}
            {statutFiltre || methodeFiltre || periode.jours !== null ? " (filtré)" : ""}
          </span>
        </div>

        <div className="mt-4 space-y-2">
          <FiltreLigne libelle="Statut">
            <Chip label="Tous" actif={!statutFiltre} params={{ ...baseParams, statut: undefined }} />
            {STATUTS.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                actif={statutFiltre === s.value}
                params={{ ...baseParams, statut: s.value }}
              />
            ))}
          </FiltreLigne>
          <FiltreLigne libelle="Méthode">
            <Chip label="Toutes" actif={!methodeFiltre} params={{ ...baseParams, methode: undefined }} />
            {METHODES.map((m) => (
              <Chip
                key={m.value}
                label={m.label}
                actif={methodeFiltre === m.value}
                params={{ ...baseParams, methode: m.value }}
              />
            ))}
          </FiltreLigne>
          <FiltreLigne libelle="Période">
            {PERIODES.map((p) => (
              <Chip
                key={p.value}
                label={p.label}
                actif={periode.value === p.value}
                params={{ ...baseParams, periode: p.value === "tout" ? undefined : p.value }}
              />
            ))}
          </FiltreLigne>
        </div>

        {detail && (
          <div className="mt-5 rounded-xl border-2 border-border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                  {detail.abonnement.eleve.codeEleve} · {detail.abonnement.plan}
                </p>
                <p className="mt-1 font-serif text-xl font-bold text-texte">
                  {formatFCFA(Number(detail.montant))} <span className="text-sm text-texte-muted">{detail.devise}</span>
                </p>
              </div>
              <Link
                href={cheminAvec("/admin/paiements", { ...baseParams, page: page > 1 ? String(page) : undefined })}
                className="text-sm font-semibold text-texte-muted hover:text-texte"
              >
                Fermer
              </Link>
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Ligne cle="Payeur" valeur={`${detail.payeurRole === "PARENT" ? "Parent" : "Élève"} · ${telMasque(detail.payeurTelephone)}`} />
              <Ligne cle="Méthode" valeur="Mobile Money" />
              <Ligne cle="Statut" valeur={STATUT_MAP.get(detail.statut)?.label ?? detail.statut} />
              <Ligne cle="Date" valeur={detail.datePaiement.toLocaleString("fr-FR")} />
              <Ligne cle="Référence transaction" valeur={detail.referenceCamerPay} mono />
              <Ligne cle="Clé d'idempotence" valeur={detail.idempotencyKey} mono />
            </dl>

            <p className="mt-5 text-xs font-bold tracking-wide text-texte-muted uppercase">
              Webhooks liés ({webhooksLies.length})
            </p>
            {webhooksLies.length === 0 ? (
              <p className="mt-2 text-sm text-texte-muted">Aucun webhook enregistré pour cette clé d&apos;idempotence.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {webhooksLies.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="font-semibold text-texte">{w.traitementStatut}</span>
                    <span className={w.signatureValide ? "text-xs text-success" : "text-xs font-bold text-danger"}>
                      {w.signatureValide ? "Signature valide" : "Signature invalide"}
                    </span>
                    <span className="text-xs text-texte-muted">
                      {w.createdAt.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {paiements.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 rounded-xl bg-fond px-4 py-12 text-center">
            <IconCreditCard className="h-6 w-6 text-texte-muted" aria-hidden="true" />
            <p className="text-sm text-texte-muted">Aucune transaction pour ce filtre.</p>
          </div>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-texte-muted uppercase">
                    <th className="pb-2 font-semibold">Élève</th>
                    <th className="pb-2 font-semibold">Payeur</th>
                    <th className="pb-2 font-semibold">Montant</th>
                    <th className="pb-2 font-semibold">Méthode</th>
                    <th className="pb-2 font-semibold">Statut</th>
                    <th className="pb-2 font-semibold">Date</th>
                    <th className="pb-2 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paiements.map((p) => {
                    const st = STATUT_MAP.get(p.statut) ?? { label: p.statut, classes: "bg-fond text-texte-muted" };
                    return (
                      <tr key={p.id} className={p.id === paiementId ? "bg-primary-light" : ""}>
                        <td className="py-2.5 font-serif font-semibold text-texte">{p.abonnement.eleve.codeEleve}</td>
                        <td className="py-2.5 text-texte-muted">
                          {p.payeurRole === "PARENT" ? "Parent" : "Élève"} · {telMasque(p.payeurTelephone)}
                        </td>
                        <td className="py-2.5 text-texte">{formatFCFA(Number(p.montant))}</td>
                        <td className="py-2.5 text-texte-muted">Mobile Money</td>
                        <td className="py-2.5">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${st.classes}`}>{st.label}</span>
                        </td>
                        <td className="py-2.5 text-texte-muted">
                          {p.datePaiement.toLocaleString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 text-right">
                          <Link
                            href={cheminAvec("/admin/paiements", {
                              ...baseParams,
                              page: page > 1 ? String(page) : undefined,
                              paiement: p.id,
                            })}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            Détail
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              basePath="/admin/paiements"
              baseParams={{ ...baseParams, paiement: paiementId }}
            />
          </>
        )}
      </section>
    </main>
  );
}

/** Construit un chemin avec query, en omettant les valeurs vides. */
function cheminAvec(base: string, params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

function PaiementTile({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-sm">
      <p className="text-xs text-texte-muted">{label}</p>
      <p className="mt-1 font-serif text-xl font-bold text-texte">{valeur}</p>
    </div>
  );
}

function FiltreLigne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-bold tracking-wide text-texte-muted uppercase">{libelle}</span>
      {children}
    </div>
  );
}

function Chip({
  label,
  actif,
  params,
}: {
  label: string;
  actif: boolean;
  params: Record<string, string | undefined>;
}) {
  return (
    <Link
      href={cheminAvec("/admin/paiements", params)}
      aria-current={actif ? "true" : undefined}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
        actif ? "bg-primary text-white" : "bg-fond text-texte-muted hover:bg-primary-light hover:text-primary"
      }`}
    >
      {label}
    </Link>
  );
}

function Ligne({ cle, valeur, mono }: { cle: string; valeur: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-texte-muted">{cle}</dt>
      <dd className={`text-right font-semibold text-texte ${mono ? "font-mono text-xs" : ""}`}>{valeur}</dd>
    </div>
  );
}
