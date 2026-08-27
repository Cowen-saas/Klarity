import { auth } from "@/auth";

const CLASSE_LABELS: Record<string, string> = {
  TROISIEME: "3e",
  PREMIERE: "1ère",
  TERMINALE: "Terminale",
};

export default async function EleveProfilPage() {
  const session = await auth();
  const classe = session?.user.classe ? (CLASSE_LABELS[session.user.classe] ?? session.user.classe) : "—";

  return (
    <main className="max-w-2xl px-6 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-texte">Profil</h1>

      <div className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
        <dl className="divide-y divide-border">
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-texte-muted">Nom</dt>
            <dd className="text-sm font-medium text-texte">{session?.user.nom ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-texte-muted">Classe</dt>
            <dd className="text-sm font-medium text-texte">
              {classe}
              {session?.user.filiere ? ` · Série ${session.user.filiere}` : ""}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-texte-muted">Code élève</dt>
            <dd className="font-serif text-sm font-semibold text-primary">{session?.user.codeEleve ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 text-sm text-texte-muted">
        Donne ce code à ton parent avec ton numéro de téléphone : c&apos;est ce qui lui permet de suivre ta progression.
      </p>
    </main>
  );
}
