import type {
  ChatMessage,
  Correction,
  ContexteEpreuve,
  ContexteMatiere,
  EpreuveRef,
  ExempleFewShot,
  LacunePourQuiz,
  QuizGenere,
  ReponseIA,
} from "./types";

/**
 * Interface AIProvider (cahier des charges §6.2) — l'appelant (route API, job BullMQ)
 * ne doit jamais connaître le nom du modèle utilisé ; la sélection Haiku/Sonnet est
 * interne à l'implémentation. affinerLacunes() n'existe plus (retirée v1.12,
 * niveauMaitrise est un calcul déterministe en code applicatif, cf. §4.3).
 */
export interface AIProvider {
  /** -> route vers Haiku (§6.1). */
  chat(
    messages: ChatMessage[],
    contexteMatiere: ContexteMatiere,
    contexteEpreuve?: ContexteEpreuve
  ): Promise<ReponseIA>;

  /** -> route vers Haiku (§6.1). */
  genererQuiz(lacunes: LacunePourQuiz[], matiere: string): Promise<QuizGenere>;

  /**
   * -> route vers Sonnet (§6.1). N'est appelée que pour numeroTentative = 1 (§4.3) —
   * les retraitements ultérieurs sont lus directement depuis CorrectionDetail
   * existant, sans appel IA. imageKeys : tableau ordonné (multi-pages, §4.3),
   * transmises en une seule requête vision, dans l'ordre.
   */
  corrigerCopie(
    imageKeys: string[],
    epreuveRef: EpreuveRef,
    bareme: unknown,
    exemplesFewShot?: ExempleFewShot[]
  ): Promise<Correction>;
}
