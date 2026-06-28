import { env } from "../../config/env";
import { AiProvider } from "./ai-provider";
import { MedGemmaAiProvider } from "./medgemma/medgemma-ai.provider";

export function createAiProvider(): AiProvider {
  // Enforce MedGemma 1.5 as the ONLY AI structuring model for Beta simplification
  return new MedGemmaAiProvider();
}

export function currentAiProviderName() {
  return "medgemma";
}
