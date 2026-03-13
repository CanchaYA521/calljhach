import "server-only";

import { z } from "zod";

import { MAX_KNOWLEDGE_FILE_SIZE_BYTES } from "@/lib/knowledge-upload";
import type {
  KnowledgeDocumentAuditAction,
  KnowledgeDocumentAuditRecord,
  KnowledgeDocumentRecord,
  KnowledgeProductType,
} from "@/lib/types";

export const KNOWLEDGE_DOCUMENT_SELECT =
  "id, user_id, title, product_type, file_path, file_name, mime_type, file_size_bytes, status, summary, extracted_text, page_count, processing_error, created_at, updated_at";

export const KNOWLEDGE_DOCUMENT_AUDIT_SELECT =
  "id, document_id, user_id, action, title, product_type, file_name, mime_type, file_size_bytes, created_at";

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/markdown",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
]);

const EXTENSION_TO_MIME_TYPE = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  txt: "text/plain",
  md: "text/markdown",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

export const knowledgeUploadSchema = z.object({
  title: z.string().trim().min(1).max(120),
  product_type: z.enum([
    "general",
    "reno",
    "porta",
    "linea_nueva",
    "fija",
    "migracion",
    "upgrade",
  ] satisfies [KnowledgeProductType, ...KnowledgeProductType[]]),
});

export function getFallbackKnowledgeTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Diagrama";
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function resolveKnowledgeMimeType(file: File) {
  const extension = getFileExtension(file.name) as keyof typeof EXTENSION_TO_MIME_TYPE;
  const mimeFromExtension = EXTENSION_TO_MIME_TYPE[extension];
  const browserMimeType = file.type.trim().toLowerCase();

  if (mimeFromExtension) {
    return mimeFromExtension;
  }

  if (SUPPORTED_MIME_TYPES.has(browserMimeType)) {
    return browserMimeType;
  }

  return null;
}

export function toKnowledgeDocumentRecord(data: unknown) {
  return data as KnowledgeDocumentRecord;
}

export function toKnowledgeDocumentAuditRecord(data: unknown) {
  return data as KnowledgeDocumentAuditRecord;
}

export function buildKnowledgeAuditInsert(input: {
  documentId: string;
  userId: string;
  action: KnowledgeDocumentAuditAction;
  title: string;
  productType: KnowledgeProductType;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}) {
  return {
    id: crypto.randomUUID(),
    document_id: input.documentId,
    user_id: input.userId,
    action: input.action,
    title: input.title,
    product_type: input.productType,
    file_name: input.fileName,
    mime_type: input.mimeType,
    file_size_bytes: input.fileSizeBytes,
  };
}
