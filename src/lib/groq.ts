import "server-only";

import { getGroqConfig } from "@/lib/server-env";

type Role = "system" | "user" | "assistant";

type ResponseContentItem =
  | {
      type: "input_text";
      text: string;
    }
  | {
      type: "output_text";
      text: string;
    }
  | {
      type: "input_image";
      image_url: string;
      detail?: "auto" | "low" | "high";
    };

type ResponseInputItem = {
  role: Role;
  content: ResponseContentItem[];
};

type GroqResponsePayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
};

type GroqChatCompletionPayload = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | {
            text?: string;
            type?: string;
          }
        | Array<{
            text?: string;
            type?: string;
          }>;
    };
  }>;
};

export function sanitizeKnowledgeAnswer(answer: string) {
  const trimmed = answer.trim();
  const metaLeadPattern =
    /^(we need to|the user asks|the user wants|we must|based on the context|let's|i should|i need to|the context says|we have a context document)/i;

  const lines = trimmed.split("\n");

  let startIndex = 0;
  while (startIndex < lines.length && metaLeadPattern.test(lines[startIndex].trim())) {
    startIndex += 1;
  }

  const cleaned = lines.slice(startIndex).join("\n").trim();

  return cleaned || trimmed;
}

export function extractOutputText(payload: GroqResponsePayload) {
  if (payload.output_text?.trim()) {
    return sanitizeKnowledgeAnswer(payload.output_text);
  }

  const fallbackText = payload.output
    ?.filter((item) => item.type === "message" || !item.type)
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" || !item.type)
    .map((item) => item.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n");

  return fallbackText ? sanitizeKnowledgeAnswer(fallbackText) : "";
}

function extractChatCompletionText(payload: GroqChatCompletionPayload) {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return sanitizeKnowledgeAnswer(content);
  }

  if (content && !Array.isArray(content)) {
    return content.text?.trim() ? sanitizeKnowledgeAnswer(content.text) : "";
  }

  const text = content
    ?.filter((item) => item.type === "output_text" || item.type === "text" || !item.type)
    .map((item) => item.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n");

  return text ? sanitizeKnowledgeAnswer(text) : "";
}

async function groqResponsesRequest(body: {
  model: string;
  input: ResponseInputItem[];
}) {
  const { GROQ_API_KEY } = getGroqConfig();
  const response = await fetch("https://api.groq.com/openai/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Groq devolvio ${response.status} al procesar la solicitud: ${errorText}`,
    );
  }

  const payload = (await response.json()) as GroqResponsePayload;
  const outputText = extractOutputText(payload);

  if (!outputText) {
    throw new Error("Groq no devolvio texto utilizable para esta solicitud.");
  }

  return outputText;
}

async function groqChatCompletionsRequest(body: {
  model: string;
  messages: Array<{
    role: Role;
    content: string;
  }>;
}) {
  const { GROQ_API_KEY } = getGroqConfig();
  const isReasoningModel = body.model.startsWith("openai/gpt-oss") || body.model.startsWith("qwen/");
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: body.model,
      messages: body.messages,
      temperature: 0,
      max_completion_tokens: 300,
      ...(isReasoningModel ? { include_reasoning: false } : {}),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Groq devolvio ${response.status} al procesar la solicitud: ${errorText}`,
    );
  }

  const payload = (await response.json()) as GroqChatCompletionPayload;
  const outputText = extractChatCompletionText(payload);

  if (!outputText) {
    throw new Error("Groq no devolvio texto utilizable para esta solicitud.");
  }

  return outputText;
}

export async function askKnowledgeQuestion(input: {
  question: string;
  history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  context: string;
}) {
  const { GROQ_TEXT_MODEL } = getGroqConfig();

  const messages = [
    {
      role: "system" as const,
      content:
        "Eres un asistente operativo para call center. Responde siempre en espanol. " +
        "Nunca muestres razonamiento, analisis, pasos internos ni texto meta. " +
        "Entrega solo la respuesta final para el asesor. " +
        "Responde solo con informacion del contexto provisto. No inventes datos. " +
        "Si el usuario pide algo puntual como contrato, speech, requisito, paso o equipo, entrega solo eso y no agregues explicaciones extra. " +
        "No uses tablas salvo que el usuario las pida. " +
        "Si el texto exacto no aparece en el contexto, responde solo: No encontre ese texto exacto en los diagramas cargados.",
    },
    ...input.history,
    {
      role: "user" as const,
      content:
        `Contexto documental:\n${input.context}\n\n` +
        `Pregunta del asesor:\n${input.question}\n\n` +
        "Formato obligatorio de respuesta:\n" +
        "- En espanol.\n" +
        "- Sin analisis ni introduccion.\n" +
        "- Sin frases como 'segun el contexto' o 'el documento indica', salvo que el usuario pida explicacion.\n" +
        "- Si pide 'dame', 'pasame', 'que equipo', 'que plan' o algo puntual, responde directo con ese contenido.\n" +
        "- Si no existe el texto exacto pedido, responde solo: No encontre ese texto exacto en los diagramas cargados.",
    },
  ];

  try {
    return await groqChatCompletionsRequest({
      model: GROQ_TEXT_MODEL,
      messages,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Groq no devolvio texto utilizable para esta solicitud."
    ) {
      const fallbackInput: ResponseInputItem[] = messages.map((message) => ({
        role: message.role,
        content: [
          {
            type: "input_text",
            text: message.content,
          },
        ],
      }));

      return groqResponsesRequest({
        model: GROQ_TEXT_MODEL,
        input: fallbackInput,
      });
    }

    throw error;
  }
}

export async function describeImageDiagram(input: {
  imageUrl: string;
  title: string;
  productLabel: string;
}) {
  const { GROQ_VISION_MODEL } = getGroqConfig();

  return groqResponsesRequest({
    model: GROQ_VISION_MODEL,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              `Analiza este diagrama operativo llamado "${input.title}" para el producto ${input.productLabel}. ` +
              "Devuelve texto plano y estructurado con estos encabezados: Resumen, Requisitos, Contrato, Pasos, Validaciones, Excepciones, Objeciones, Cierres, Notas. " +
              "Si un apartado no aparece, indicalo como no visible.",
          },
          {
            type: "input_image",
            detail: "auto",
            image_url: input.imageUrl,
          },
        ],
      },
    ],
  });
}
