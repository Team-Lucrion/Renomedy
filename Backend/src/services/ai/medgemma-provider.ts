import { logger } from "../../config/logger";
import { buildClinicalReasoningPrompt, PROMPT_VERSION } from "./prompts";
import { cleanJsonResponse, validateReasoningResponse } from "./validation";
import type { AiProvider, AiReasoningResult } from "./ai-provider";
import type { OcrParsedMedication } from "../ocr/ocr-provider";

export type MedGemmaConfig = {
  endpoint: string;
  apiKey?: string;
  model: string;
  timeoutMs: number;
  retryCount: number;
  maxTokens: number;
  temperature: number;
};

export class MedGemmaProvider implements AiProvider {
  constructor(private readonly config: MedGemmaConfig) {}

  async reason(text: string, _options?: Record<string, unknown>): Promise<AiReasoningResult> {
    const prompt = buildClinicalReasoningPrompt(text);
    let attempts = 0;
    const startTime = Date.now();

    while (attempts <= this.config.retryCount) {
      attempts++;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const response = await fetch(this.config.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {})
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [
              { role: "system", content: "You are a clinical reasoning assistant. Return valid JSON only." },
              { role: "user", content: prompt }
            ],
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            response_format: { type: "json_object" }
          }),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`MedGemma API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content || "";

        if (!rawContent) {
          throw new Error("MedGemma returned empty content");
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

        logger.info({
          provider: "medgemma",
          model: this.config.model,
          latency: modelLatencyMs,
          attempts,
          promptVersion: PROMPT_VERSION
        }, "AI clinical reasoning successful");

        return {
          medications,
          warnings: structured.warnings,
          rawModelResponse: rawContent,
          modelLatencyMs,
          promptVersion: PROMPT_VERSION,
          provider: "medgemma",
          model: this.config.model,
          retryCount: attempts - 1
        };
      } catch (error) {
        logger.error({
          err: error,
          attempt: attempts,
          provider: "medgemma"
        }, "MedGemma reasoning attempt failed");

        if (attempts > this.config.retryCount) {
          throw error;
        }
        // Small backoff
        await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
      }
    }

    throw new Error("Clinical reasoning failed after retries");
  }
}
