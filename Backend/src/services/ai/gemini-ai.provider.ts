import { env } from "../../config/env";
import { AiProvider, AiParseResult } from "./ai-provider";
import {
  SAFE_LOW_QUALITY_MESSAGE,
  assessOcrQuality,
  buildMedicineCardData,
  cleanOcrText,
  mapMedicinesToParseResult,
  normalizeWhitespace,
  parseMedicinesFromOcrText,
} from "../ocr/gemini-prescription-parse";

export class GeminiAiProvider implements AiProvider {
  async processPrescription(ocrText: string, ocrMetadata?: Record<string, unknown>, segmentation?: Record<string, unknown>): Promise<AiParseResult> {
    const cleanedText = cleanOcrText(ocrText);

    if (!cleanedText || cleanedText.length < 15) {
      return {
        rawText: ocrText,
        cleanedText,
        parseStatus: "failed",
        medications: [],
        cardData: buildMedicineCardData([], "low", [SAFE_LOW_QUALITY_MESSAGE], cleanedText),
        aiProvider: "gemini",
        aiModel: env.GEMINI_MODEL,
        providerMetadata: {
          provider: "gemini_ai",
          failure_reason: "no_text_detected",
          error: "Provided OCR text did not contain enough readable prescription text.",
          raw_text_preview: cleanedText.slice(0, 500),
          ocr_metadata: ocrMetadata,
          segmentation,
        },
      };
    }

    try {
      const { parsed, rawResponse } = await parseMedicinesFromOcrText(cleanedText);
      const medications = mapMedicinesToParseResult(Array.isArray(parsed.medicines) ? parsed.medicines : []);
      const warnings = (Array.isArray(parsed.warnings) ? parsed.warnings : [])
        .map((warning) => normalizeWhitespace(warning))
        .filter(Boolean);

      const modelQuality =
        parsed.ocr_quality === "high" || parsed.ocr_quality === "medium" || parsed.ocr_quality === "low"
          ? parsed.ocr_quality
          : "low";
      const ocrQuality = modelQuality === "low" ? assessOcrQuality(ocrText) : modelQuality;

      return {
        rawText: ocrText,
        cleanedText,
        parseStatus: medications.length > 0 ? "parsed" : "failed",
        medications,
        cardData: buildMedicineCardData(
          medications,
          medications.length > 0 ? ocrQuality : "low",
          warnings.length > 0 ? warnings : medications.length > 0 ? [] : [SAFE_LOW_QUALITY_MESSAGE],
          cleanedText
        ),
        aiProvider: "gemini",
        aiModel: env.GEMINI_MODEL,
        rawModelResponse: rawResponse,
        providerMetadata: {
          provider: "gemini_ai",
          ai_engine: "google-genai-gemini",
          warnings,
          parse_status: medications.length > 0 ? "parsed" : "failed",
          failure_reason: medications.length > 0 ? undefined : "no_medicines_parsed",
          error: medications.length > 0 ? undefined : "Gemini did not return any valid medicines from the OCR text.",
          raw_text_preview: cleanedText.slice(0, 500),
          ocr_metadata: ocrMetadata,
          segmentation,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Prescription decoding failed";
      return {
        rawText: ocrText,
        cleanedText,
        parseStatus: "failed",
        medications: [],
        cardData: buildMedicineCardData([], "low", [SAFE_LOW_QUALITY_MESSAGE], cleanedText),
        aiProvider: "gemini",
        aiModel: env.GEMINI_MODEL,
        providerMetadata: {
          provider: "gemini_ai",
          ai_engine: "google-genai-gemini",
          failure_reason: "ai_pipeline_error",
          error: "Prescription decoding failed before any medicines could be extracted.",
          root_error: message,
          raw_text_preview: cleanedText.slice(0, 500),
          ocr_metadata: ocrMetadata,
          segmentation,
        },
      };
    }
  }
}
