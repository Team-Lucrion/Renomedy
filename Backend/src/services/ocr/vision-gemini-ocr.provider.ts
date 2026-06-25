import { env } from "../../config/env";
import type { OcrParseResult, OcrProvider } from "./ocr-provider";
import {
  SAFE_LOW_QUALITY_MESSAGE,
  assessOcrQuality,
  buildMedicineCardData,
  cleanOcrText,
  mapMedicinesToParseResult,
  normalizeWhitespace,
  parseMedicinesFromOcrText,
} from "./gemini-prescription-parse";
import { extractTextWithGoogleVision } from "./google-vision-text";

export class VisionGeminiOcrProvider implements OcrProvider {
  async parsePrescription(imageBuffer: Buffer, _metadata?: Record<string, unknown>): Promise<OcrParseResult> {
    let rawText = "";

    try {
      rawText = await extractTextWithGoogleVision(imageBuffer);
      const cleanedText = cleanOcrText(rawText);

      if (!cleanedText || cleanedText.length < 15) {
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
            failure_reason: "no_text_detected",
            error: "Google Vision did not return enough readable prescription text from the image.",
            raw_text_preview: cleanedText.slice(0, 500),
          },
        };
      }

      const { parsed, rawResponse } = await parseMedicinesFromOcrText(cleanedText);
      const medications = mapMedicinesToParseResult(Array.isArray(parsed.medicines) ? parsed.medicines : []);
      const warnings = (Array.isArray(parsed.warnings) ? parsed.warnings : [])
        .map((warning) => normalizeWhitespace(warning))
        .filter(Boolean);

      const modelQuality =
        parsed.ocr_quality === "high" || parsed.ocr_quality === "medium" || parsed.ocr_quality === "low"
          ? parsed.ocr_quality
          : "low";
      const ocrQuality = modelQuality === "low" ? assessOcrQuality(rawText) : modelQuality;

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
        aiProvider: "gemini",
        aiModel: env.GEMINI_MODEL,
        rawModelResponse: rawResponse,
        providerMetadata: {
          provider: "vision_gemini",
          ocr_engine: "google-cloud-vision",
          ai_engine: "google-genai-gemini",
          warnings,
          parse_status: medications.length > 0 ? "parsed" : "failed",
          failure_reason: medications.length > 0 ? undefined : "no_medicines_parsed",
          error: medications.length > 0 ? undefined : "Gemini did not return any valid medicines from the OCR text.",
          raw_text_preview: cleanedText.slice(0, 500),
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
