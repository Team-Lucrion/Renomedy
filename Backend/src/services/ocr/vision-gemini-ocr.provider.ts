import { env } from "../../config/env";
import type { OcrParseResult, OcrProvider } from "./ocr-provider";
import {
  SAFE_LOW_QUALITY_MESSAGE,
  assessOcrQuality,
  buildMedicineCardData,
  cleanOcrText,
} from "./gemini-prescription-parse";
import { extractTextWithGoogleVision } from "./google-vision-text";
import { createAiProvider } from "../ai/ai-provider.factory";

export class VisionGeminiOcrProvider implements OcrProvider {
  async parsePrescription(
    imageBuffer: Buffer,
    options?: { extractedText?: string; ocrMetadata?: Record<string, unknown> }
  ): Promise<OcrParseResult> {
    let rawText = options?.extractedText || "";

    try {
      if (!rawText) {
        rawText = await extractTextWithGoogleVision(imageBuffer);
      }

      const cleanedText = cleanOcrText(rawText);

      if (!cleanedText || cleanedText.length < 15) {
        return {
          rawText,
          cleanedText,
          parseStatus: "failed",
          medications: [],
          cardData: buildMedicineCardData([], "low", [SAFE_LOW_QUALITY_MESSAGE], cleanedText),
          aiProvider: process.env.AI_PROVIDER || "gemini",
          aiModel: process.env.AI_PROVIDER === "medgemma" ? process.env.MEDGEMMA_MODEL : env.GEMINI_MODEL,
          providerMetadata: {
            provider: "vision_gemini",
            ocr_engine: "google-cloud-vision",
            failure_reason: "no_text_detected",
            error: "Google Vision did not return enough readable prescription text from the image.",
            raw_text_preview: cleanedText.slice(0, 500),
          },
        };
      }

      const aiProvider = createAiProvider();
      const reasoningResult = await aiProvider.reason(cleanedText);

      const medications = reasoningResult.medications;
      const warnings = reasoningResult.warnings;
      const ocrQuality = assessOcrQuality(rawText);

      return {
        rawText,
        cleanedText,
        parseStatus: medications.length > 0 ? "parsed" : "failed",
        medications,
        cardData: buildMedicineCardData(
          medications,
          medications.length > 0 ? ocrQuality : "low",
          warnings.length > 0 ? warnings : medications.length > 0 ? [] : [SAFE_LOW_QUALITY_MESSAGE],
          cleanedText
        ),
        aiProvider: reasoningResult.provider,
        aiModel: reasoningResult.model,
        rawModelResponse: reasoningResult.rawModelResponse,
        providerMetadata: {
          provider: "vision_gemini",
          ocr_engine: options?.extractedText ? "ml-kit-edge" : "google-cloud-vision",
          edge_metadata: options?.ocrMetadata,
          ai_engine: reasoningResult.provider,
          warnings,
          parse_status: medications.length > 0 ? "parsed" : "failed",
          failure_reason: medications.length > 0 ? undefined : "no_medicines_parsed",
          error: medications.length > 0 ? undefined : "AI did not return any valid medicines from the OCR text.",
          raw_text_preview: cleanedText.slice(0, 500),
          prompt_version: reasoningResult.promptVersion,
          latency_ms: reasoningResult.modelLatencyMs,
          retry_count: reasoningResult.retryCount
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Prescription decoding failed";
      const cleanedText = cleanOcrText(rawText);
      return {
        rawText,
        cleanedText,
        parseStatus: "failed",
        medications: [],
        cardData: buildMedicineCardData([], "low", [SAFE_LOW_QUALITY_MESSAGE], cleanedText),
        aiProvider: "gemini",
        aiModel: env.GEMINI_MODEL,
        providerMetadata: {
          provider: "vision_gemini",
          ocr_engine: "google-cloud-vision",
          ai_engine: "google-genai-gemini",
          failure_reason: "ocr_pipeline_error",
          error: "Prescription decoding failed before any medicines could be extracted.",
          root_error: message,
          raw_text_preview: cleanedText.slice(0, 500),
        },
      };
    }
  }
}
