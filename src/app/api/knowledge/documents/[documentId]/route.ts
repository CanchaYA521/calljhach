import { NextResponse } from "next/server";
import { z } from "zod";

import { getKnowledgeProductLabel, sanitizeStorageFileName } from "@/lib/knowledge";
import { processKnowledgeDocument } from "@/lib/knowledge-processing";
import {
  buildKnowledgeAuditInsert,
  KNOWLEDGE_DOCUMENT_AUDIT_SELECT,
  KNOWLEDGE_DOCUMENT_SELECT,
  knowledgeUploadSchema,
  MAX_KNOWLEDGE_FILE_SIZE_BYTES,
  resolveKnowledgeMimeType,
  toKnowledgeDocumentAuditRecord,
  toKnowledgeDocumentRecord,
} from "@/lib/knowledge-server";
import { createClient } from "@/lib/supabase/server";
import type { KnowledgeDocumentAuditRecord, KnowledgeDocumentRecord } from "@/lib/types";

export const runtime = "nodejs";

const paramsSchema = z.object({
  documentId: z.string().uuid(),
});

function normalizeDocument(data: unknown) {
  return data as KnowledgeDocumentRecord;
}

async function rollbackDocumentUpdate(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  document: KnowledgeDocumentRecord;
  chunkSwapBase: number;
  newFilePath: string;
}) {
  await input.supabase
    .from("knowledge_chunks")
    .delete()
    .eq("document_id", input.document.id)
    .gte("chunk_index", input.chunkSwapBase);

  await input.supabase
    .from("knowledge_documents")
    .update({
      title: input.document.title,
      product_type: input.document.product_type,
      file_path: input.document.file_path,
      file_name: input.document.file_name,
      mime_type: input.document.mime_type,
      file_size_bytes: input.document.file_size_bytes,
      status: input.document.status,
      summary: input.document.summary,
      extracted_text: input.document.extracted_text,
      page_count: input.document.page_count,
      processing_error: input.document.processing_error,
    })
    .eq("id", input.document.id)
    .eq("user_id", input.document.user_id);

  await input.supabase.storage
    .from("knowledge-documents")
    .remove([input.newFilePath]);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  const { data: existingDocument, error: documentError } = await supabase
    .from("knowledge_documents")
    .select(KNOWLEDGE_DOCUMENT_SELECT)
    .eq("id", parsedParams.data.documentId)
    .eq("user_id", user.id)
    .single();

  if (documentError) {
    return NextResponse.json(
      { error: `No se pudo consultar el documento: ${documentError.message}` },
      { status: 400 },
    );
  }

  const currentDocument = normalizeDocument(existingDocument);
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Selecciona un archivo antes de actualizar el diagrama." },
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
    title: String(formData.get("title") ?? currentDocument.title),
    product_type: String(formData.get("product_type") ?? currentDocument.product_type),
  });

  if (!parsedFields.success) {
    return NextResponse.json(
      { error: parsedFields.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const nextFilePath = `${user.id}/${currentDocument.id}/${Date.now()}-${sanitizeStorageFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from("knowledge-documents")
    .upload(nextFilePath, buffer, {
      contentType: resolvedMimeType,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `No se pudo subir el nuevo archivo: ${uploadError.message}` },
      { status: 400 },
    );
  }

  try {
    let imageUrl: string | null = null;

    if (resolvedMimeType.startsWith("image/")) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("knowledge-documents")
        .createSignedUrl(nextFilePath, 60 * 15);

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

    const chunkSwapBase = Date.now() * 1000;
    const { error: insertChunksError } = await supabase.from("knowledge_chunks").insert(
      processed.chunks.map((chunk) => ({
        document_id: currentDocument.id,
        user_id: user.id,
        chunk_index: chunkSwapBase + chunk.chunk_index,
        page_number: chunk.page_number,
        content: chunk.content,
      })),
    );

    if (insertChunksError) {
      throw new Error(insertChunksError.message);
    }

    const { data: updatedDocument, error: updateError } = await supabase
      .from("knowledge_documents")
      .update({
        title: parsedFields.data.title,
        product_type: parsedFields.data.product_type,
        file_path: nextFilePath,
        file_name: file.name,
        mime_type: resolvedMimeType,
        file_size_bytes: file.size,
        status: "ready",
        summary: processed.summary,
        extracted_text: processed.extractedText,
        page_count: processed.pageCount,
        processing_error: null,
      })
      .eq("id", currentDocument.id)
      .eq("user_id", user.id)
      .select(KNOWLEDGE_DOCUMENT_SELECT)
      .single();

    if (updateError) {
      await rollbackDocumentUpdate({
        supabase,
        document: currentDocument,
        chunkSwapBase,
        newFilePath: nextFilePath,
      });
      throw new Error(updateError.message);
    }

    const { error: deleteOldChunksError } = await supabase
      .from("knowledge_chunks")
      .delete()
      .eq("document_id", currentDocument.id)
      .lt("chunk_index", chunkSwapBase);

    if (deleteOldChunksError) {
      await rollbackDocumentUpdate({
        supabase,
        document: currentDocument,
        chunkSwapBase,
        newFilePath: nextFilePath,
      });
      throw new Error(deleteOldChunksError.message);
    }

    const { data: auditRecord, error: auditError } = await supabase
      .from("knowledge_document_audits")
      .insert(
        buildKnowledgeAuditInsert({
          documentId: currentDocument.id,
          userId: user.id,
          action: "updated",
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
      await rollbackDocumentUpdate({
        supabase,
        document: currentDocument,
        chunkSwapBase,
        newFilePath: nextFilePath,
      });
      throw new Error(auditError.message);
    }

    if (currentDocument.file_path && currentDocument.file_path !== nextFilePath) {
      await supabase.storage
        .from("knowledge-documents")
        .remove([currentDocument.file_path]);
    }

    return NextResponse.json({
      document: toKnowledgeDocumentRecord(updatedDocument),
      audit: toKnowledgeDocumentAuditRecord(auditRecord) as KnowledgeDocumentAuditRecord,
    });
  } catch (error) {
    await supabase.storage.from("knowledge-documents").remove([nextFilePath]);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el diagrama.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  const { data: document, error: documentError } = await supabase
    .from("knowledge_documents")
    .select("id, file_path")
    .eq("id", parsedParams.data.documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (documentError) {
    return NextResponse.json(
      { error: `No se pudo consultar el documento: ${documentError.message}` },
      { status: 400 },
    );
  }

  if (!document) {
    return NextResponse.json(
      { error: "El diagrama no existe o ya fue eliminado." },
      { status: 404 },
    );
  }

  if (document.file_path) {
    const { error: storageError } = await supabase.storage
      .from("knowledge-documents")
      .remove([document.file_path]);

    if (storageError) {
      return NextResponse.json(
        { error: `No se pudo borrar el archivo del storage: ${storageError.message}` },
        { status: 400 },
      );
    }
  }

  const { error: deleteError } = await supabase
    .from("knowledge_documents")
    .delete()
    .eq("id", document.id)
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json(
      { error: `No se pudo borrar el documento: ${deleteError.message}` },
      { status: 400 },
    );
  }

  return NextResponse.json({
    documentId: document.id,
  });
}
