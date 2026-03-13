"use client";

import clsx from "clsx";
import { useState, type FormEvent } from "react";

import { readApiResponse } from "@/lib/http";
import type { KnowledgeChatMessage } from "@/lib/types";

type QuickHelpSheetProps = {
  activeContextLabel: string;
};

export function QuickHelpSheet({ activeContextLabel }: QuickHelpSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<KnowledgeChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  async function submitQuestion(rawQuestion: string) {
    const trimmedQuestion = rawQuestion.trim();

    if (!trimmedQuestion || isAsking) {
      return;
    }

    setChatError(null);
    setQuestion("");

    const userMessage: KnowledgeChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedQuestion,
    };
    setMessages((current) => [...current, userMessage]);
    setIsAsking(true);

    try {
      const response = await fetch("/api/knowledge/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          history: messages.slice(-8).map((message) => ({
            role: message.role,
            content: message.content,
          })),
          scope: "all",
        }),
      });
      const payload = await readApiResponse<{
        answer?: string;
        citations?: KnowledgeChatMessage["citations"];
        error?: string;
      }>(response, "No se pudo responder la consulta.");

      if (!response.ok || !payload.answer) {
        throw new Error(payload.error ?? "No se pudo responder la consulta.");
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.answer!,
          citations: payload.citations ?? [],
        },
      ]);
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== userMessage.id));
      setQuestion(trimmedQuestion);
      setChatError(
        error instanceof Error ? error.message : "No se pudo responder la consulta.",
      );
    } finally {
      setIsAsking(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitQuestion(question);
  }

  return (
    <>
      <div
        className={clsx(
          "fixed inset-0 z-40 bg-[#151311]/35 transition",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsOpen(false)}
      />

      <aside
        className={clsx(
          "fixed inset-y-3 right-3 z-50 flex w-[min(620px,calc(100vw-1.5rem))] flex-col rounded-[1.6rem] border border-line bg-[rgba(252,250,246,0.98)] shadow-[0_28px_80px_rgba(31,24,18,0.26)] transition duration-200",
          isOpen ? "translate-x-0 opacity-100" : "translate-x-[105%] opacity-0",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-strong">
              Ayuda rápida
            </p>
            <h2 className="mt-1.5 text-xl font-semibold">Asistente de llamada</h2>
            <p className="mt-1 text-sm muted-text">Contexto activo: {activeContextLabel}</p>
            <p className="mt-1 text-sm muted-text">Busca siempre en todos los diagramas listos.</p>
          </div>
          <button
            className="btn-secondary px-3 py-2 text-sm font-semibold"
            onClick={() => setIsOpen(false)}
            type="button"
          >
            Cerrar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-3">
            {messages.length ? (
              messages.map((message) => (
                <article
                  className={clsx(
                    "rounded-[1.15rem] border px-4 py-3",
                    message.role === "assistant"
                      ? "border-line bg-white/88"
                      : "border-accent-soft bg-accent-soft/65",
                  )}
                  key={message.id}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                    {message.role === "assistant" ? "Asistente" : "Tú"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                    {message.content}
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-line-strong bg-white/60 px-4 py-10 text-center">
                <p className="text-base font-semibold">Consulta lista para la llamada.</p>
                <p className="mt-1 text-sm muted-text">
                  Escribe tu consulta exacta y buscaré en todos los diagramas disponibles.
                </p>
              </div>
            )}

            {isAsking ? (
              <div className="rounded-[1.15rem] border border-line bg-white/88 px-4 py-3 text-sm">
                Revisando diagramas...
              </div>
            ) : null}
          </div>
        </div>

        <form className="border-t border-line px-5 py-5" onSubmit={handleSubmit}>
          <textarea
            className="field min-h-36 resize-y"
            disabled={isAsking}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Pregunta exacta para la llamada..."
            value={question}
          />

          {chatError ? (
            <div className="mt-3 rounded-[1.1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {chatError}
            </div>
          ) : null}

          <button
            className="btn-primary mt-3 w-full px-5 py-3 text-sm font-semibold"
            disabled={isAsking || !question.trim()}
            type="submit"
          >
            {isAsking ? "Consultando..." : "Preguntar"}
          </button>
        </form>
      </aside>

      <button
        className={clsx(
          "fixed bottom-5 right-5 z-50 rounded-full px-5 py-3 text-sm font-semibold shadow-[0_18px_36px_rgba(10,81,73,0.28)] transition",
          isOpen ? "btn-secondary" : "btn-primary",
        )}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        {isOpen ? "Ocultar ayuda" : "Ayuda rápida"}
      </button>
    </>
  );
}
