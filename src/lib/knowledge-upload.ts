const BYTES_PER_MEGABYTE = 1024 * 1024;

// Keep uploads below Vercel's request cap because multipart/form-data adds overhead.
export const MAX_KNOWLEDGE_FILE_SIZE_BYTES = 4 * BYTES_PER_MEGABYTE;
export const MAX_KNOWLEDGE_FILE_SIZE_LABEL = "4 MB";

const PAYLOAD_TOO_LARGE_PATTERNS = [
  /request entity too large/i,
  /payload too large/i,
  /body exceeded/i,
  /content-length/i,
  /request aborted/i,
];

export function getKnowledgeFileTooLargeMessage() {
  return `El archivo supera el límite de ${MAX_KNOWLEDGE_FILE_SIZE_LABEL} para esta carga.`;
}

export function isKnowledgeFileTooLarge(file: Pick<File, "size"> | null | undefined) {
  return Boolean(file && file.size > MAX_KNOWLEDGE_FILE_SIZE_BYTES);
}

export function isKnowledgeUploadTooLargeMessage(message: string) {
  return PAYLOAD_TOO_LARGE_PATTERNS.some((pattern) => pattern.test(message));
}

export function getKnowledgeUploadRequestError(error: unknown) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  if (isKnowledgeUploadTooLargeMessage(message)) {
    return {
      error: getKnowledgeFileTooLargeMessage(),
      status: 413,
    };
  }

  return {
    error: "No se pudo leer el archivo enviado. Intenta de nuevo.",
    status: 400,
  };
}
