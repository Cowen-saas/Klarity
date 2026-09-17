import type { AIProvider } from "./provider";
import {
  AIRateLimitError,
  type BaremeCorrection,
  type ChatMessage,
  type Correction,
  type ContexteEpreuve,
  type ContexteMatiere,
  type EpreuveRef,
  type ExempleFewShot,
  type FiltrageVideos,
  type LacunePourQuiz,
  type QuizGenere,
  type ReponseIA,
  type VideoCandidate,
} from "./types";

/**
 * Simule des réponses réalistes sans clé API Anthropic (§6.3) : couvre l'UI complète
 * du chat, de l'upload/correction et du quiz, et permet de tester le retry avec
 * backoff sur 429 avant même d'avoir un accès Claude réel. Une erreur 429 est
 * simulée à la demande via AI_MOCK_FORCE_429=true (§6.3).
 */
export class MockAIProvider implements AIProvider {
  private maybeSimulateRateLimit(): void {
    if (process.env.AI_MOCK_FORCE_429 === "true") {
      throw new AIRateLimitError();
    }
  }

  async chat(
    messages: ChatMessage[],
    _contexteMatiere: ContexteMatiere,
    contexteEpreuve?: ContexteEpreuve
  ): Promise<ReponseIA> {
    this.maybeSimulateRateLimit();
    const derniereQuestion = messages.at(-1)?.contenu ?? "";
    const contenu = contexteEpreuve
      ? `[MOCK][Haiku] Réponse contextualisée à l'épreuve en cours pour : "${derniereQuestion}". ` +
        `(énoncé et corrigé injectés comme contexte, cf. §2.1, §4.4)`
      : `[MOCK][Haiku] Réponse générale de cours pour : "${derniereQuestion}".`;
    return {
      contenu,
      tokensInput: estimerTokens(messages.map((m) => m.contenu).join(" ")),
      tokensOutput: estimerTokens(contenu),
    };
  }

  async genererQuiz(lacunes: LacunePourQuiz[], matiere: string): Promise<QuizGenere> {
    this.maybeSimulateRateLimit();
    const cibles = lacunes.length > 0 ? lacunes : [{ id: "mock", notion: matiere, niveauMaitrise: 0 }];
    const questions = cibles.map((lacune, index) => ({
      enonce: `[MOCK] Question ${index + 1} sur la notion "${lacune.notion}" (${matiere}).`,
      choix: ["Proposition A", "Proposition B", "Proposition C", "Proposition D"],
      bonneReponse: "Proposition A",
      explication: `[MOCK] Explication simulée pour la notion "${lacune.notion}".`,
      lacuneId: lacune.id,
    }));
    const texte = questions.map((q) => q.enonce).join(" ");
    return { questions, tokensInput: estimerTokens(texte), tokensOutput: estimerTokens(texte) };
  }

  async corrigerCopie(
    imageKeys: string[],
    epreuveRef: EpreuveRef,
    _bareme: BaremeCorrection,
    exemplesFewShot?: ExempleFewShot[]
  ): Promise<Correction> {
    this.maybeSimulateRateLimit();

    // Convention de test (§2.1, bug copie invalide) : une clé contenant "copie-invalide"
    // simule le refus de Sonnet, sans avoir besoin d'un vrai appel Sonnet pour tester ce chemin.
    if (imageKeys.some((k) => k.includes("copie-invalide"))) {
      const raisonRefus = "[MOCK] Les pièces jointes ne correspondent pas à une copie exploitable pour cette épreuve.";
      return {
        copieValide: false,
        raisonRefus,
        note: 0,
        pointsForts: [],
        pointsManques: [],
        feedbackDetaille: raisonRefus,
        tokensInput: estimerTokens(raisonRefus),
        tokensOutput: estimerTokens(raisonRefus),
      };
    }

    const feedbackDetaille =
      `[MOCK][Sonnet] Correction simulée de l'épreuve ${epreuveRef.epreuveId} ` +
      `(${epreuveRef.matiere}, ${epreuveRef.classe}${epreuveRef.filiere ? `, série ${epreuveRef.filiere}` : ""}) ` +
      `à partir de ${imageKeys.length} page(s) uploadée(s)` +
      (exemplesFewShot?.length ? `, avec ${exemplesFewShot.length} exemple(s) few-shot injecté(s).` : ".");

    return {
      copieValide: true,
      note: 12.5,
      pointsForts: ["[MOCK] Structure claire", "[MOCK] Bonne maîtrise du vocabulaire spécifique"],
      pointsManques: [
        { notion: `${epreuveRef.matiere} — notion clé`, detail: "[MOCK] Point manqué simulé pour tester le pipeline de lacunes." },
      ],
      feedbackDetaille,
      tokensInput: estimerTokens(feedbackDetaille) * imageKeys.length,
      tokensOutput: estimerTokens(feedbackDetaille),
    };
  }

  async filtrerVideos(candidats: VideoCandidate[], notion: string, matiere: string): Promise<FiltrageVideos> {
    this.maybeSimulateRateLimit();
    const retenues = candidats.slice(0, 1).map((c) => ({ videoId: c.videoId, titre: `[MOCK] ${c.titre}` }));
    const texte = `[MOCK][Haiku] Filtrage vidéo simulé pour la notion "${notion}" (${matiere}).`;
    return { retenues, tokensInput: estimerTokens(texte), tokensOutput: estimerTokens(texte) };
  }
}

function estimerTokens(texte: string): number {
  return Math.max(1, Math.ceil(texte.length / 4));
}
