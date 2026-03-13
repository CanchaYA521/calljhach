import { NextResponse } from "next/server";

import { getKnowledgeProductLabel, sanitizeStorageFileName } from "@/lib/knowledge";
import { processKnowledgeDocument } from "@/lib/knowledge-processing";
import {
  buildKnowledgeAuditInsert,
  getFallbackKnowledgeTitle,
  KNOWLEDGE_DOCUMENT_AUDIT_SELECT,
  KNOWLEDGE_DOCUMENT_SELECT,
  knowledgeUploadSchema,
  MAX_KNOWLEDGE_FILE_SIZE_BYTES,
  resolveKnowledgeMimeType,
  toKnowledgeDocumentAuditRecord,
  toKnowledgeDocumentRecord,
} from "@/lib/knowledge-server";
import { createClient } from "@/lib/supabase/server";
import type { KnowledgeDocumentAuditRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Selecciona un archivo antes de subirlo." },
      { status: 400 },
    );
  }

  const resolvedMimeType = resolveKnowledgeMimeType(file);

  if (!resolvedMimeType) {
    return NextResponse.json(
      {
        error:
          "Formato no soportado. Usa PDF, PNG, JPG, WEBP, TXT, MD, XLSX o XLSM para los diagramas.",
      },
      { status: 400 },
    );
  }

  if (file.size > MAX_KNOWLEDGE_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 15 MB." },
      { status: 400 },
    );
  }

  const parsedFields = knowledgeUploadSchema.safeParse({
    title: String(formData.get("title") ?? getFallbackKnowledgeTitle(file.name)),
    product_type: String(formData.get("product_type") ?? "general"),
  });

  if (!parsedFields.success) {
    return NextResponse.json(
      { error: parsedFields.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const documentId = crypto.randomUUID();
  const filePath = `${user.id}/${documentId}/${sanitizeStorageFileName(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: insertError } = await supabase.from("knowledge_documents").insert({
    id: documentId,
    user_id: user.id,
    title: parsedFields.data.title,
    product_type: parsedFields.data.product_type,
    file_path: filePath,
    file_name: file.name,
    mime_type: resolvedMimeType,
    file_size_bytes: file.size,
    status: "processing",
  });

  if (insertError) {
    return NextResponse.json(
      { error: `No se pudo registrar el documento: ${insertError.message}` },
      { status: 400 },
    );
  }

  const { error: uploadError } = await supabase.storage
    .from("knowledge-documents")
    .upload(filePath, buffer, {
      contentType: resolvedMimeType,
      upsert: false,
    });

  if (uploadError) {
    await supabase
      .from("knowledge_documents")
      .update({
        status: "error",
        processing_error: uploadError.message,
      })
      .eq("id", documentId);

    return NextResponse.json(
      { error: `No se pudo subir el archivo: ${uploadError.message}` },
      { status: 400 },
    );
  }

  try {
    let imageUrl: string | null = null;

    if (resolvedMimeType.startsWith("image/")) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("knowledge-documents")
        .createSignedUrl(filePath, 60 * 15);

      if (signedUrlError) {
        throw new Error(signedUrlError.message);
      }

      imageUrl = signedUrlData.signedUrl;
    }

    const processed = await processKnowledgeDocument({
      buffer,
      title: parsedFields.data.title,
      mimeType: resolvedMimeType,
      productLabel: getKnowledgeProductLabel(parsedFields.data.product_type),
      imageUrl,
    });

    if (!processed.chunks.length) {
      throw new Error(
        "No se detectó contenido suficiente para responder preguntas sobre este diagrama.",
      );
    }

    const { error: chunksError } = await supabase.from("knowledge_chunks").insert(
      processed.chunks.map((chunk) => ({
        document_id: documentId,
        user_id: user.id,
        chunk_index: chunk.chunk_index,
        page_number: chunk.page_number,
        content: chunk.content,
      })),
    );

    if (chunksError) {
      throw new Error(chunksError.message);
    }

    const { data: readyDocument, error: updateError } = await supabase
      .from("knowledge_documents")
      .update({
        status: "ready",
        summary: processed.summary,
        extracted_text: processed.extractedText,
        page_count: processed.pageCount,
        processing_error: null,
      })
      .eq("id", documentId)
      .select(KNOWLEDGE_DOCUMENT_SELECT)
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { data: createdAudit, error: auditError } = await supabase
      .from("knowledge_document_audits")
      .insert(
        buildKnowledgeAuditInsert({
          documentId,
          userId: user.id,
          action: "created",
          title: parsedFields.data.title,
          productType: parsedFields.data.product_type,
          fileName: file.name,
          mimeType: resolvedMimeType,
          fileSizeBytes: file.size,
        }),
      )
      .select(KNOWLEDGE_DOCUMENT_AUDIT_SELECT)
      .single();

    if (auditError) {
      throw new Error(auditError.message);
    }

    return NextResponse.json({
      document: toKnowledgeDocumentRecord(readyDocument),
      audit: toKnowledgeDocumentAuditRecord(createdAudit) as KnowledgeDocumentAuditRecord,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo procesar el documento.";

    const { data: erroredDocument } = await supabase
      .from("knowledge_documents")
      .update({
        status: "error",
        processing_error: message,
      })
      .eq("id", documentId)
      .select(KNOWLEDGE_DOCUMENT_SELECT)
      .single();

    return NextResponse.json(
      {
        error: message,
        document: erroredDocument ? toKnowledgeDocumentRecord(erroredDocument) : null,
      },
      { status: 400 },
    );
  }
}
