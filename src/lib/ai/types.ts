/**
 * Shared types for the AIProvider abstraction (cahier des charges §6.2).
 * Kept provider-agnostic: MockAIProvider and the future ClaudeAIProvider (§6.5)
 * both implement AIProvider using only these shapes — nothing here should leak
 * Anthropic-specific concepts (model names, message formats, etc.).
 */

export type RoleMessageChat = "ELEVE" | "ASSISTANT";

export interface ChatMessage {
  role: RoleMessageChat;
  contenu: string;
}

/**
 * contenuStructure de ProgrammeOfficiel (§4.2.3) pour la matière/classe/série de
 * l'élève — toujours fourni au chat, y compris pour les matières hors banque
 * d'épreuves (§1.2, §4.2).
 */
export type ContexteMatiere = unknown;

/** Fourni uniquement en mode chat contextualisé à une épreuve (§2.1, §4.4). */
export interface ContexteEpreuve {
  enonce: string;
  corrige: string;
}

export interface ReponseIA {
  contenu: string;
  tokensInput: number;
  tokensOutput: number;
}

export interface LacunePourQuiz {
  id: string;
  notion: string;
  niveauMaitrise: number;
}

export interface QuestionGeneree {
  enonce: string;
  choix: string[];
  bonneReponse: string;
  lacuneId?: string;
}

export interface QuizGenere {
  questions: QuestionGeneree[];
}

export interface EpreuveRef {
  epreuveId: string;
  matiere: string;
  classe: string;
  filiere?: string | null;
}

/**
 * ExempleCorrection (§4.2.2) déjà résolu par matiereId + typeExercice, injecté
 * comme few-shot pour Français/Philosophie — ignoré pour les matières
 * scientifiques (§4.2.2, §6.2).
 */
export interface ExempleFewShot {
  enonceModele: string;
  baremeStructure: unknown;
  exempleReponseModele: string;
  notesMethodologiques: string;
}

export interface PointManque {
  notion: string;
  detail: string;
}

export interface Correction {
  note: number;
  pointsForts: string[];
  pointsManques: PointManque[];
  feedbackDetaille: string;
  tokensInput: number;
  tokensOutput: number;
}

/** Levée par MockAIProvider quand une erreur 429 est simulée à la demande (§6.3). */
export class AIRateLimitError extends Error {
  constructor(message = "AI provider rate limit exceeded (simulated)") {
    super(message);
    this.name = "AIRateLimitError";
  }
}
