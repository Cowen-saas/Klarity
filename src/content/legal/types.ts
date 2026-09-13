/**
 * Types du contenu juridique (Mentions Légales, CGU, Politique de Confidentialité) —
 * extrait automatiquement des documents `.docx` sources (`docs/legal/`, conservés
 * comme référence/archive, non servis publiquement, cf. `docs/PROGRESS.md`).
 * Le script d'extraction préserve l'ordre du document, les titres (Heading 1/2),
 * les listes à puces, les tableaux et les encarts (cellule unique en gras + texte,
 * utilisés dans les documents sources pour les avertissements de transparence).
 */
export type LegalBlock =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "callout"; title: string; text: string };

export interface LegalMeta {
  marque: string;
  titre: string;
  sousTitre: string;
  complement: string;
  version: string;
}
