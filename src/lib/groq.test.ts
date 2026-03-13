import { describe, expect, it } from "vitest";

import { extractOutputText, sanitizeKnowledgeAnswer } from "./groq";

describe("groq answer sanitization", () => {
  it("removes english meta reasoning prefixes from the model output", () => {
    const raw =
      "We need to provide the contract using only the context.\nThe user asks for solo chip.\n\nNo encontre ese texto exacto en los diagramas cargados.";

    expect(sanitizeKnowledgeAnswer(raw)).toBe(
      "No encontre ese texto exacto en los diagramas cargados.",
    );
  });

  it("ignores reasoning blocks when extracting response text", () => {
    expect(
      extractOutputText({
        output: [
          {
            type: "reasoning",
            content: [
              {
                type: "reasoning_text",
                text: "User asks for equipo with plan VIP 50.",
              },
            ],
          },
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "Apple iPhone 13 128 GB.",
              },
            ],
          },
        ],
      }),
    ).toBe("Apple iPhone 13 128 GB.");
  });
});
