import { env } from "../../config/env";
import { GeminiAiProvider } from "./gemini-ai-provider";
import { MedGemmaProvider } from "./medgemma-provider";
import type { AiProvider } from "./ai-provider";

export function createAiProvider(): AiProvider {
  const providerType = (env.AI_PROVIDER || "gemini").toLowerCase();

  if (providerType === "medgemma") {
    return new MedGemmaProvider({
      endpoint: env.MEDGEMMA_ENDPOINT,
      apiKey: env.MEDGEMMA_API_KEY,
      model: env.MEDGEMMA_MODEL,
      timeoutMs: env.MEDGEMMA_TIMEOUT_MS,
      retryCount: env.MEDGEMMA_RETRY_COUNT,
      maxTokens: env.MEDGEMMA_MAX_TOKENS,
      temperature: env.MEDGEMMA_TEMPERATURE
    });
  }

  // Default to Gemini
  return new GeminiAiProvider(env.GEMINI_API_KEY || "", env.GEMINI_MODEL);
}
