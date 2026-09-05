"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { MatiereSwitcher } from "./MatiereSwitcher";
import { MessageBubble } from "./MessageBubble";
import { IconSparkles, IconSend } from "@/components/icons";

interface Matiere {
  id: string;
  nom: string;
}

interface Message {
  id: string;
  role: "ELEVE" | "ASSISTANT";
  contenu: string;
}

export function ChatPanel() {
  const [matieres, setMatieres] = useState<Matiere[] | null>(null);
  const [selectedMatiereId, setSelectedMatiereId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [chargement, setChargement] = useState(true);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const finDuFilRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let annule = false;
    apiFetch("/api/eleve/matieres")
      .then((res) => res.json())
      .then((data: { matieres?: Matiere[] }) => {
        if (annule || !data.matieres) return;
        setMatieres(data.matieres);
        if (data.matieres.length > 0) {
          selectionnerMatiere(data.matieres[0].id);
        } else {
          setChargement(false);
        }
      })
      .catch(() => {
        if (!annule) {
          setErreur("Impossible de charger tes matières.");
          setChargement(false);
        }
      });
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    finDuFilRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function selectionnerMatiere(matiereId: string) {
    setSelectedMatiereId(matiereId);
    setChargement(true);
    setErreur(null);
    try {
      const res = await apiFetch("/api/eleve/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matiereId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.error ?? "Impossible d'ouvrir cette conversation.");
        return;
      }
      setConversationId(data.conversation.id);
      setMessages(data.conversation.messages);
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setChargement(false);
    }
  }

  async function envoyerMessage() {
    const contenu = inputValue.trim();
    if (!contenu || !conversationId || envoiEnCours) return;

    setInputValue("");
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      const res = await apiFetch(`/api/eleve/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenu }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.error ?? "Le message n'a pas pu être envoyé.");
        return;
      }
      setMessages((prev) => [...prev, data.messageEleve, data.messageAssistant]);
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col rounded-2xl bg-surface shadow-sm md:h-[calc(100vh-6rem)]">
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
          <IconSparkles className="h-5 w-5" weight="fill" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-bold text-texte">Tuteur IA</p>
          <p className="text-xs text-success">● En ligne</p>
        </div>
      </div>

      {matieres && matieres.length > 0 && (
        <div className="border-b border-border">
          <MatiereSwitcher matieres={matieres} selectedId={selectedMatiereId} onSelect={selectionnerMatiere} />
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {matieres && matieres.length === 0 && (
          <p className="text-sm text-texte-muted">
            Aucune matière disponible pour ta classe pour le moment.
          </p>
        )}
        {chargement && <p className="text-sm text-texte-muted">Chargement…</p>}
        {!chargement &&
          messages.map((m) => <MessageBubble key={m.id} role={m.role} contenu={m.contenu} />)}
        {!chargement && messages.length === 0 && conversationId && (
          <p className="text-sm text-texte-muted">Pose ta première question sur cette matière.</p>
        )}
        {envoiEnCours && (
          <div className="flex justify-start">
            <p className="rounded-2xl bg-fond px-4 py-3 text-sm text-texte-muted">Le tuteur réfléchit…</p>
          </div>
        )}
        <div ref={finDuFilRef} />
      </div>

      {erreur && <p className="px-4 pb-2 text-sm text-danger">{erreur}</p>}

      <div className="flex items-center gap-2 border-t border-border p-4">
        <label htmlFor="chat-input" className="sr-only">
          Écris ta question
        </label>
        <input
          id="chat-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && envoyerMessage()}
          disabled={!conversationId || envoiEnCours}
          placeholder="Écris ta question..."
          className="flex-1 rounded-full border-2 border-border bg-fond px-4 py-2.5 text-sm text-texte outline-none transition-colors focus:border-primary disabled:opacity-60"
        />
        <button
          type="button"
          onClick={envoyerMessage}
          disabled={!conversationId || envoiEnCours || !inputValue.trim()}
          aria-label="Envoyer"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          <IconSend className="h-4 w-4" weight="fill" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
