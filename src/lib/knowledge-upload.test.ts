import { describe, expect, it } from "vitest";

import {
  getKnowledgeFileTooLargeMessage,
  getKnowledgeUploadRequestError,
  isKnowledgeFileTooLarge,
  MAX_KNOWLEDGE_FILE_SIZE_BYTES,
} from "./knowledge-upload";

describe("knowledge upload helpers", () => {
  it("rejects files above the configured upload limit", () => {
    expect(
      isKnowledgeFileTooLarge({
        size: MAX_KNOWLEDGE_FILE_SIZE_BYTES + 1,
      } as File),
    ).toBe(true);

    expect(
      isKnowledgeFileTooLarge({
        size: MAX_KNOWLEDGE_FILE_SIZE_BYTES,
      } as File),
    ).toBe(false);
  });

  it("maps oversized request parser errors to a user-facing message", () => {
    expect(
      getKnowledgeUploadRequestError(new Error("request entity too large")),
    ).toEqual({
      error: getKnowledgeFileTooLargeMessage(),
      status: 413,
    });
  });

  it("falls back to a generic parser error message", () => {
    expect(getKnowledgeUploadRequestError(new Error("unexpected boundary"))).toEqual({
      error: "No se pudo leer el archivo enviado. Intenta de nuevo.",
      status: 400,
    });
  });
});
