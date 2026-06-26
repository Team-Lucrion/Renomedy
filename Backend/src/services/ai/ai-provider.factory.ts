import { env } from "../../config/env";
import { AiProvider } from "./ai-provider";
import { GeminiAiProvider } from "./gemini-ai.provider";
import { MedGemmaAiProvider } from "./medgemma/medgemma-ai.provider";

export function createAiProvider(): AiProvider {
  if (env.AI_PROVIDER === "medgemma") {
    return new MedGemmaAiProvider();
  }

  // Default to Gemini as per requirements
  return new GeminiAiProvider();
}

export function currentAiProviderName() {
  return env.AI_PROVIDER;
}
