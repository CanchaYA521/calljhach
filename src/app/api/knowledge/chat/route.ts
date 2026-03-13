import { NextResponse } from "next/server";
import { z } from "zod";

import { askKnowledgeQuestion } from "@/lib/groq";
import {
  answerStructuredOfferQuestion,
  buildKnowledgeContext,
  rankKnowledgeChunks,
  selectKnowledgeDocumentsForChat,
} from "@/lib/knowledge";
import { KNOWLEDGE_DOCUMENT_SELECT } from "@/lib/knowledge-server";
import { createClient } from "@/lib/supabase/server";
import type {
  KnowledgeChatScope,
  KnowledgeChunkRecord,
  KnowledgeDocumentRecord,
  ProductType,
} from "@/lib/types";

export const runtime = "nodejs";

const chatRequestSchema = z.object({
  question: z.string().trim().min(2).max(1000),
  documentId: z.string().uuid().nullable().optional(),
  productType: z
    .enum([
      "reno",
      "porta",
      "linea_nueva",
      "fija",
      "migracion",
      "upgrade",
    ] satisfies [ProductType, ...ProductType[]])
    .nullable()
    .optional(),
  scope: z.enum(["product", "all"] satisfies [KnowledgeChatScope, ...KnowledgeChatScope[]]).default("all"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .max(8)
    .default([]),
});

type RankableChunk = KnowledgeChunkRecord & {
  document: Pick<KnowledgeDocumentRecord, "id" | "title" | "product_type">;
};

function normalizeDocument(data: unknown) {
  return data as KnowledgeDocumentRecord;
}

function normalizeChunk(data: unknown) {
  return data as KnowledgeChunkRecord;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  const payload = chatRequestSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Consulta inválida." },
      { status: 400 },
    );
  }

  try {
    const { data: documentsData, error: documentsError } = await supabase
      .from("knowledge_documents")
      .select(KNOWLEDGE_DOCUMENT_SELECT)
      .eq("user_id", user.id)
      .eq("status", "ready")
      .order("updated_at", { ascending: false })
      .limit(48);

    if (documentsError) {
      throw new Error(documentsError.message);
    }

    const documents = selectKnowledgeDocumentsForChat(
      (documentsData ?? []).map(normalizeDocument),
      {
        documentId: payload.data.documentId ?? null,
        productType: payload.data.productType ?? null,
        scope: payload.data.scope,
      },
    );

    if (!documents.length) {
      return NextResponse.json(
        {
          error: payload.data.documentId
            ? "Ese diagrama no está listo para responder preguntas."
            : "No hay diagramas listos para responder preguntas todavía.",
        },
        { status: 400 },
      );
    }

    const documentIds = documents.map((document) => document.id);
    const { data: chunksData, error: chunksError } = await supabase
      .from("knowledge_chunks")
      .select("id, document_id, user_id, chunk_index, page_number, content, created_at")
      .in("document_id", documentIds)
      .order("chunk_index", { ascending: true });

    if (chunksError) {
      throw new Error(chunksError.message);
    }

    const documentsById = new Map(documents.map((document) => [document.id, document]));
    const rankableChunks: RankableChunk[] = (chunksData ?? [])
      .map(normalizeChunk)
      .map((chunk) => {
        const document = documentsById.get(chunk.document_id);

        if (!document) {
          return null;
        }

        return {
          ...chunk,
          document: {
            id: document.id,
            title: document.title,
            product_type: document.product_type,
          },
        };
      })
      .filter((chunk): chunk is RankableChunk => chunk !== null);

    if (!rankableChunks.length) {
      return NextResponse.json(
        { error: "Los diagramas todavía no tienen contenido indexado." },
        { status: 400 },
      );
    }

    const structuredOfferAnswer = answerStructuredOfferQuestion(
      rankableChunks,
      payload.data.question,
    );

    if (structuredOfferAnswer) {
      return NextResponse.json(structuredOfferAnswer);
    }

    const rankedChunks = rankKnowledgeChunks(rankableChunks, payload.data.question);
    const fallbackChunks = [...rankableChunks].sort(
      (left, right) => left.chunk_index - right.chunk_index,
    );
    const { context, citations } = buildKnowledgeContext(
      rankedChunks.length ? rankedChunks : fallbackChunks,
    );

    const answer = await askKnowledgeQuestion({
      question: payload.data.question,
      history: payload.data.history,
      context,
    });

    return NextResponse.json({
      answer,
      citations,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo resolver la consulta del chat.",
      },
      { status: 400 },
    );
  }
}
