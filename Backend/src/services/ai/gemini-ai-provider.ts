import { GoogleGenAI } from "@google/genai";
import { logger } from "../../config/logger";
import { buildClinicalReasoningPrompt, PROMPT_VERSION } from "./prompts";
import { cleanJsonResponse, validateReasoningResponse } from "./validation";
import type { AiProvider, AiReasoningResult } from "./ai-provider";
import type { OcrParsedMedication } from "../ocr/ocr-provider";

export class GeminiAiProvider implements AiProvider {
  constructor(private readonly apiKey: string, private readonly modelName: string) {}

  async reason(text: string, _options?: Record<string, unknown>): Promise<AiReasoningResult> {
    const startTime = Date.now();
    const client = new GoogleGenAI({ apiKey: this.apiKey });

    const prompt = buildClinicalReasoningPrompt(text);

    try {
      const response = await client.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      const rawContent = response.text?.trim() || "";
      if (!rawContent) {
        throw new Error("Gemini returned an empty response");
      }

      const cleanedJson = cleanJsonResponse(rawContent);
      const structured = validateReasoningResponse(JSON.parse(cleanedJson));
      const modelLatencyMs = Date.now() - startTime;

      const medications: OcrParsedMedication[] = structured.medicines.map((m) => ({
        medicineName: m.name,
        genericName: m.genericName,
        strength: m.strength,
        dosage: m.dose || m.strength,
        dose: m.dose,
        frequency: m.frequency,
        timing: m.timing,
        foodTiming: m.foodTiming,
        duration: m.durationDays ? `${m.durationDays} days` : undefined,
        instructions: m.instructions,
        confidence: m.confidence >= 0.85 ? "high" : m.confidence >= 0.6 ? "medium" : "low",
        shorthandDetected: m.frequency ? [m.frequency] : [],
        shorthandExplanation: m.frequencyMeaning,
        confidenceScore: m.confidence,
        requiresManualVerification: m.needsReview
      }));

      return {
        medications,
        warnings: structured.warnings,
        rawModelResponse: rawContent,
        modelLatencyMs,
        promptVersion: PROMPT_VERSION,
        provider: "gemini",
        model: this.modelName,
        retryCount: 0
      };
    } catch (error) {
      logger.error({ err: error, provider: "gemini" }, "Gemini reasoning failed");
      throw error;
    }
  }
}
