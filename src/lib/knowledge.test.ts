import { describe, expect, it } from "vitest";

import {
  answerStructuredOfferQuestion,
  buildDocumentSummary,
  buildKnowledgeContext,
  extractKnowledgeOffers,
  rankKnowledgeChunks,
  selectKnowledgeDocumentsForChat,
  splitTextIntoChunks,
} from "./knowledge";
import type { KnowledgeChunkRecord, KnowledgeDocumentRecord } from "./types";

function makeDocument(
  overrides: Partial<KnowledgeDocumentRecord>,
): KnowledgeDocumentRecord {
  return {
    id: "doc-1",
    user_id: "user-1",
    title: "Portabilidad marzo",
    product_type: "porta",
    file_path: "user-1/doc-1/file.pdf",
    file_name: "file.pdf",
    mime_type: "application/pdf",
    file_size_bytes: 1024,
    status: "ready",
    summary: "Resumen",
    extracted_text: "Texto",
    page_count: 2,
    processing_error: null,
    created_at: "2026-03-11T12:00:00.000Z",
    updated_at: "2026-03-11T12:00:00.000Z",
    ...overrides,
  };
}

function makeChunk(
  overrides: Partial<KnowledgeChunkRecord> & {
    document?: Pick<KnowledgeDocumentRecord, "id" | "title" | "product_type">;
  },
) {
  const document = overrides.document ?? makeDocument({});

  return {
    id: "chunk-1",
    document_id: document.id,
    user_id: "user-1",
    chunk_index: 0,
    page_number: 1,
    content: "Contrato firmado, DNI, validacion biometrica y SEC activo.",
    created_at: "2026-03-11T12:00:00.000Z",
    ...overrides,
    document,
  };
}

describe("knowledge helpers", () => {
  it("splits long knowledge text into readable chunks", () => {
    const text = Array.from({ length: 40 }, (_, index) => `Paso ${index + 1}.`).join(" ");

    expect(splitTextIntoChunks(text, { chunkSize: 60, overlap: 10 }).length).toBeGreaterThan(1);
  });

  it("builds a compact summary", () => {
    expect(buildDocumentSummary("  Validacion de contrato   y DNI  ", "fallback")).toBe(
      "Validacion de contrato y DNI",
    );
  });

  it("ranks chunks matching the question first", () => {
    const ranked = rankKnowledgeChunks(
      [
        makeChunk({
          chunk_index: 1,
          content: "Paso de migracion con contrato, validacion y objeciones.",
        }),
        makeChunk({
          chunk_index: 2,
          content: "Cierre comercial de renovacion con bono y permanencia.",
          document: makeDocument({
            id: "doc-2",
            title: "Renovacion abril",
            product_type: "reno",
          }),
        }),
      ],
      "contrato migracion",
    );

    expect(ranked[0]?.chunk_index).toBe(1);
  });

  it("builds context and citations from ranked chunks", () => {
    const { context, citations } = buildKnowledgeContext([
      makeChunk({
        content: "Contrato y requisitos para portabilidad.",
      }),
    ]);

    expect(context).toContain("Portabilidad marzo");
    expect(citations[0]?.title).toBe("Portabilidad marzo");
    expect(citations[0]?.page_number).toBe(1);
  });

  it("extracts structured offers from offer chunks", () => {
    const offers = extractKnowledgeOffers([
      makeChunk({
        content:
          "[Oferta pagina 1]\nPrecio: S/ 149 x 12 meses\nPlan: Max VIP 50\nBeneficios: 85 GB x 12 meses Luego 40 GB\nEquipos: APPLE IPHONE 13 128 GB; XIAOMI 15T 512 GB",
      }),
    ]);

    expect(offers[0]?.priceValue).toBe(149);
    expect(offers[0]?.plan).toBe("Max VIP 50");
    expect(offers[0]?.equipments).toEqual([
      "APPLE IPHONE 13 128 GB",
      "XIAOMI 15T 512 GB",
    ]);
  });

  it("answers cheapest structured offer questions deterministically", () => {
    const result = answerStructuredOfferQuestion(
      [
        makeChunk({
          chunk_index: 1,
          content:
            "[Oferta pagina 1]\nPrecio: S/ 279\nPlan: Max VIP Ilimitado 99\nBeneficios: 140 GB + ILIMITADO\nEquipos: SAMSUNG GALAXY S26 128 GB; APPLE IPHONE 17 256 GB",
        }),
        makeChunk({
          chunk_index: 2,
          content:
            "[Oferta pagina 1]\nPrecio: S/ 149 x 12 meses\nPlan: Max VIP 50\nBeneficios: 85 GB x 12 meses Luego 40 GB\nEquipos: APPLE IPHONE 13 128 GB; XIAOMI 15T 512 GB",
        }),
      ],
      "cual es el plan mas barato para sacar un equipo",
    );

    expect(result?.answer).toContain("Plan más barato: S/ 149 x 12 meses - Max VIP 50");
    expect(result?.answer).toContain("APPLE IPHONE 13 128 GB y XIAOMI 15T 512 GB");
  });

  it("filters documents for product scope and includes general support docs", () => {
    const selected = selectKnowledgeDocumentsForChat(
      [
        makeDocument({ id: "doc-general", product_type: "general", title: "Base general" }),
        makeDocument({ id: "doc-porta", product_type: "porta", title: "Porta abril" }),
        makeDocument({ id: "doc-reno", product_type: "reno", title: "Reno abril" }),
      ],
      {
        productType: "porta",
        scope: "product",
      },
    );

    expect(selected.map((document) => document.id)).toEqual([
      "doc-general",
      "doc-porta",
    ]);
  });

  it("falls back to all documents when no product-specific docs exist", () => {
    const selected = selectKnowledgeDocumentsForChat(
      [
        makeDocument({ id: "doc-fija", product_type: "fija" }),
        makeDocument({ id: "doc-reno", product_type: "reno" }),
      ],
      {
        productType: "porta",
        scope: "product",
      },
    );

    expect(selected).toHaveLength(2);
  });

  it("prioritizes explicit document selection over scope filtering", () => {
    const selected = selectKnowledgeDocumentsForChat(
      [
        makeDocument({ id: "doc-general", product_type: "general" }),
        makeDocument({ id: "doc-porta", product_type: "porta" }),
      ],
      {
        documentId: "doc-porta",
        productType: "reno",
        scope: "product",
      },
    );

    expect(selected.map((document) => document.id)).toEqual(["doc-porta"]);
  });
});
