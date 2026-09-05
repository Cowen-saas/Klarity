import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { Prisma, TypeEvenementAudit } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { IconShield } from "@/components/icons";
import { Pagination, lirePage } from "@/components/admin/Pagination";

export const metadata: Metadata = {
  title: "Sécurité — Admin Klarity",
  robots: { index: false, follow: false },
};

const PAR_PAGE = 20;

const LABELS_EVENEMENT: Record<TypeEvenementAudit, string> = {
  LOGIN_FAIL: "Échec de connexion admin",
  OTP_FAIL: "Code OTP invalide",
  PIN_FAIL: "Code secret élève invalide",
  IDOR_BLOCKED: "Accès refusé à une ressource d'un autre compte",
  WEBHOOK_INVALID: "Webhook reçu avec signature invalide",
  COMPTE_INACTIF_DETECTE: "Compte détecté inactif",
  COMPTE_ANONYMISE_AUTO: "Compte anonymisé automatiquement",
  COMPTE_ANONYMISE_MANUEL: "Compte anonymisé manuellement",
};

const NIVEAU_EVENEMENT: Record<TypeEvenementAudit, "critique" | "attention" | "info"> = {
  LOGIN_FAIL: "attention",
  OTP_FAIL: "attention",
  PIN_FAIL: "attention",
  IDOR_BLOCKED: "critique",
  WEBHOOK_INVALID: "critique",
  COMPTE_INACTIF_DETECTE: "info",
  COMPTE_ANONYMISE_AUTO: "info",
  COMPTE_ANONYMISE_MANUEL: "info",
};

const TOUS_LES_TYPES = Object.keys(LABELS_EVENEMENT) as TypeEvenementAudit[];

function estTypeValide(v: string | undefined): v is TypeEvenementAudit {
  return v !== undefined && (TOUS_LES_TYPES as string[]).includes(v);
}

/**
 * Observabilité sécurité (§2.3, réf. sécurité §5) — journal `audit_log_securite`
 * filtrable et paginé, plus les webhooks rejetés. La vue d'ensemble `/admin` en
 * montre un résumé ; cet écran est le journal complet.
 */
export default async function AdminSecuritePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string }>;
}) {
  const session = await auth();
  if (!session || session.error || session.user.role !== "ADMIN") {
    redirect("/admin/connexion");
  }

  const { page: pageParam, type: typeParam } = await searchParams;
  const typeFiltre = estTypeValide(typeParam) ? typeParam : undefined;
  const where: Prisma.AuditLogSecuriteWhereInput = typeFiltre ? { typeEvenement: typeFiltre } : {};

  const ilYa24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [total, parType, connexionsEchouees24h, webhooksInvalides24h, accesNonAutorises24h, webhooksRejetes] =
    await Promise.all([
      prisma.auditLogSecurite.count({ where }),
      prisma.auditLogSecurite.groupBy({ by: ["typeEvenement"], _count: { _all: true } }),
      prisma.auditLogSecurite.count({
        where: { typeEvenement: { in: ["LOGIN_FAIL", "OTP_FAIL", "PIN_FAIL"] }, createdAt: { gte: ilYa24h } },
      }),
      prisma.webhookLog.count({ where: { signatureValide: false, createdAt: { gte: ilYa24h } } }),
      prisma.auditLogSecurite.count({ where: { typeEvenement: "IDOR_BLOCKED", createdAt: { gte: ilYa24h } } }),
      prisma.webhookLog.findMany({
        where: { signatureValide: false },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, provider: true, traitementStatut: true, createdAt: true },
      }),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const page = lirePage(pageParam, totalPages);

  const evenements = await prisma.auditLogSecurite.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAR_PAGE,
    take: PAR_PAGE,
    select: { id: true, typeEvenement: true, ip: true, utilisateurId: true, details: true, createdAt: true },
  });

  const comptesParType = new Map(parType.map((r) => [r.typeEvenement, r._count._all]));

  return (
    <main className="max-w-6xl px-6 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-texte">Sécurité</h1>
      <p className="mt-1 text-sm text-texte-muted">
        Journal d&apos;audit complet (§2.3) — tentatives de connexion, blocages IDOR, webhooks rejetés, événements de
        rétention.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SecuriteTile label="Connexions échouées (24h)" valeur={connexionsEchouees24h} niveau={connexionsEchouees24h > 0 ? "attention" : "ok"} />
        <SecuriteTile label="Webhooks invalides (24h)" valeur={webhooksInvalides24h} niveau={webhooksInvalides24h > 0 ? "critique" : "ok"} />
        <SecuriteTile label="Accès non autorisés (24h)" valeur={accesNonAutorises24h} niveau={accesNonAutorises24h > 0 ? "critique" : "ok"} />
      </div>

      <section className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-texte">Journal d&apos;audit</h2>
          <span className="text-xs text-texte-muted">
            {total.toLocaleString("fr-FR")} événement{total > 1 ? "s" : ""}
            {typeFiltre ? " (filtré)" : ""}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <FiltreChip label="Tous" actif={!typeFiltre} href="/admin/securite" />
          {TOUS_LES_TYPES.filter((t) => (comptesParType.get(t) ?? 0) > 0).map((t) => (
            <FiltreChip
              key={t}
              label={`${LABELS_EVENEMENT[t]} (${comptesParType.get(t)})`}
              actif={typeFiltre === t}
              href={`/admin/securite?type=${t}`}
            />
          ))}
        </div>

        {evenements.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 rounded-xl bg-fond px-4 py-12 text-center">
            <IconShield className="h-6 w-6 text-texte-muted" aria-hidden="true" />
            <p className="text-sm text-texte-muted">Aucun événement pour ce filtre.</p>
          </div>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-texte-muted uppercase">
                    <th className="pb-2 font-semibold">Événement</th>
                    <th className="pb-2 font-semibold">Compte</th>
                    <th className="pb-2 font-semibold">IP</th>
                    <th className="pb-2 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {evenements.map((ev) => {
                    const niveau = NIVEAU_EVENEMENT[ev.typeEvenement];
                    return (
                      <tr key={ev.id}>
                        <td className="py-2.5">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              niveau === "critique" ? "bg-danger" : niveau === "attention" ? "bg-accent" : "bg-border"
                            }`}
                            aria-hidden="true"
                          />
                          <span className="ml-2 font-semibold text-texte">
                            {LABELS_EVENEMENT[ev.typeEvenement]}
                          </span>
                        </td>
                        <td className="py-2.5 font-serif text-xs text-texte-muted">{ev.utilisateurId ?? "—"}</td>
                        <td className="py-2.5 font-serif text-xs text-texte-muted">{ev.ip ?? "—"}</td>
                        <td className="py-2.5 text-texte-muted">
                          {ev.createdAt.toLocaleString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
              basePath="/admin/securite"
              baseParams={{ type: typeFiltre }}
            />
          </>
        )}
      </section>

      <section className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
        <h2 className="text-base font-bold text-texte">Webhooks rejetés (signature invalide)</h2>
        {webhooksRejetes.length === 0 ? (
          <p className="mt-3 text-sm text-texte-muted">Aucun webhook rejeté enregistré.</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {webhooksRejetes.map((w) => (
              <div key={w.id} className="flex items-center justify-between py-3 text-sm">
                <p className="font-semibold text-texte">{w.provider}</p>
                <p className="text-texte-muted">{w.traitementStatut}</p>
                <p className="text-texte-muted">
                  {w.createdAt.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-texte-muted">
          Chaque webhook rejeté est conservé dans la piste d&apos;audit append-only — la signature HMAC est vérifiée
          avant toute écriture de paiement.
        </p>
      </section>
    </main>
  );
}

function SecuriteTile({ label, valeur, niveau }: { label: string; valeur: number; niveau: "ok" | "attention" | "critique" }) {
  const styles =
    niveau === "critique"
      ? "bg-danger-light text-danger"
      : niveau === "attention"
        ? "bg-accent-light text-texte"
        : "bg-surface text-texte";
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${styles}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="mt-1 font-serif text-2xl font-bold">{valeur.toLocaleString("fr-FR")}</p>
    </div>
  );
}

function FiltreChip({ label, actif, href }: { label: string; actif: boolean; href: string }) {
  return (
    <Link
      href={href}
      aria-current={actif ? "true" : undefined}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
        actif ? "bg-primary text-white" : "bg-fond text-texte-muted hover:bg-primary-light hover:text-primary"
      }`}
    >
      {label}
    </Link>
  );
}
