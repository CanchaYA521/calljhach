type ApiErrorPayload = {
  error?: string;
};

function cleanPlainTextResponse(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export async function readApiResponse<T extends ApiErrorPayload>(
  response: Response,
  fallbackError: string,
): Promise<T> {
  const rawText = await response.text();

  if (!rawText.trim()) {
    return response.ok ? ({} as T) : ({ error: fallbackError } as T);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawText) as T;
    } catch {
      if (!response.ok) {
        return {
          error: fallbackError,
        } as T;
      }
    }
  }

  const text = cleanPlainTextResponse(rawText);

  if (/^<!doctype html/i.test(text) || /^<html/i.test(text)) {
    return {
      error: fallbackError,
    } as T;
  }

  return {
    error: text,
  } as T;
}
