import { describe, expect, it } from "vitest";

import { readApiResponse } from "./http";

describe("readApiResponse", () => {
  it("parses JSON payloads", async () => {
    const payload = await readApiResponse<{ answer?: string }>(
      new Response(JSON.stringify({ answer: "ok" }), {
        headers: {
          "Content-Type": "application/json",
        },
      }),
      "Fallback",
    );

    expect(payload.answer).toBe("ok");
  });

  it("falls back to plain-text errors", async () => {
    const payload = await readApiResponse<{ error?: string }>(
      new Response("request entity too large", {
        status: 413,
        headers: {
          "Content-Type": "text/plain",
        },
      }),
      "Fallback",
    );

    expect(payload.error).toBe("request entity too large");
  });

  it("hides HTML error pages behind the fallback message", async () => {
    const payload = await readApiResponse<{ error?: string }>(
      new Response("<!doctype html><html><body>boom</body></html>", {
        status: 500,
        headers: {
          "Content-Type": "text/html",
        },
      }),
      "Fallback",
    );

    expect(payload.error).toBe("Fallback");
  });
});
