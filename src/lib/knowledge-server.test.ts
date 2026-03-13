import { describe, expect, it } from "vitest";

import { buildKnowledgeAuditInsert } from "./knowledge-server";

describe("knowledge server helpers", () => {
  it("builds an audit snapshot from the current document payload", () => {
    const audit = buildKnowledgeAuditInsert({
      documentId: "doc-1",
      userId: "user-1",
      action: "updated",
      title: "Portabilidad marzo",
      productType: "porta",
      fileName: "porta-marzo.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 4096,
    });

    expect(audit.document_id).toBe("doc-1");
    expect(audit.user_id).toBe("user-1");
    expect(audit.action).toBe("updated");
    expect(audit.title).toBe("Portabilidad marzo");
    expect(audit.product_type).toBe("porta");
    expect(audit.file_name).toBe("porta-marzo.pdf");
    expect(audit.mime_type).toBe("application/pdf");
    expect(audit.file_size_bytes).toBe(4096);
    expect(audit.id).toBeTypeOf("string");
  });
});
