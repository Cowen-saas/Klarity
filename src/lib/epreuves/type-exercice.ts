import type { NiveauClasse, TypeExerciceCorrection } from "@prisma/client";

/**
 * Matières pour lesquelles `Epreuve.typeExercice` est requis (le barème
 * appliqué en correction en dépend directement — cf. commentaire sur le champ
 * dans `prisma/schema.prisma`). Toute autre matière : le champ doit rester
 * NULL, le pipeline de correction utilisant alors uniquement le corrigé de
 * l'épreuve.
 */
export const MATIERES_AVEC_TYPE_EXERCICE = ["Français", "Philosophie"] as const;

/**
 * Sous-ensemble valide de `TypeExerciceCorrection` pour une matière/classe
 * donnée — `null` si la matière n'utilise pas ce champ. Philosophie n'existe
 * qu'en Première/Terminale (pas de distinction supplémentaire par classe) ;
 * Français distingue 3ème (EXPRESSION_ECRITE/CORRECTION_ORTHOGRAPHIQUE, ajoutés
 * CDC v1.31) des 5 types méthodologiques partagés 1ère/Terminale.
 */
export function typesExerciceValides(matiereNom: string, classe: NiveauClasse): TypeExerciceCorrection[] | null {
  if (matiereNom === "Philosophie") {
    return ["DISSERTATION_PHILO"];
  }
  if (matiereNom === "Français") {
    return classe === "TROISIEME"
      ? ["EXPRESSION_ECRITE", "CORRECTION_ORTHOGRAPHIQUE"]
      : ["DISSERTATION_LITTERAIRE", "CONTRACTION_TEXTE", "DISCUSSION", "COMMENTAIRE_COMPOSE"];
  }
  return null;
}
