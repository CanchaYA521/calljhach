import "server-only";

import { z } from "zod";

const groqModelSchema = z.object({
  GROQ_TEXT_MODEL: z.string().default("openai/gpt-oss-20b"),
  GROQ_VISION_MODEL: z.string().default("meta-llama/llama-4-scout-17b-16e-instruct"),
});

const groqSchema = groqModelSchema.extend({
  GROQ_API_KEY: z.string().min(1),
});

function readGroqEnv() {
  return {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_TEXT_MODEL: process.env.GROQ_TEXT_MODEL,
    GROQ_VISION_MODEL: process.env.GROQ_VISION_MODEL,
  };
}

export function getGroqModels() {
  return groqModelSchema.parse(readGroqEnv());
}

export function getGroqConfig() {
  const parsed = groqSchema.safeParse(readGroqEnv());

  if (!parsed.success) {
    throw new Error(
      `Configura GROQ_API_KEY antes de usar el chat de diagramas: ${parsed.error.issues
        .map((issue) => issue.path.join("."))
        .join(", ")}`,
    );
  }

  return parsed.data;
}
