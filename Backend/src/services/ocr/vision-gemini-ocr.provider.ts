import { env } from "../../config/env";
import type { OcrParseResult, OcrProvider } from "./ocr-provider";
import {
  SAFE_LOW_QUALITY_MESSAGE,
  assessOcrQuality,
  buildMedicineCardData,
  mapMedicinesToParseResult,
  normalizeWhitespace,
  parseMedicinesFromOcrText,
} from "./gemini-prescription-parse";
import { extractTextWithGoogleVision } from "./google-vision-text";

export class VisionGeminiOcrProvider implements OcrProvider {
  async parsePrescription(imageBuffer: Buffer): Promise<OcrParseResult> {
    let rawText = "";

    try {
      rawText = await extractTextWithGoogleVision(imageBuffer);

      if (!rawText || rawText.length < 15) {
        return {
          rawText,
          cleanedText: rawText,
          parseStatus: "failed",
          medications: [],
          cardData: buildMedicineCardData([], "low", [SAFE_LOW_QUALITY_MESSAGE], rawText),
          aiProvider: "gemini",
          aiModel: env.GEMINI_MODEL,
          providerMetadata: {
            provider: "vision_gemini",
            ocr_engine: "google-cloud-vision",
            error: SAFE_LOW_QUALITY_MESSAGE,
            raw_text_preview: rawText.slice(0, 500),
          },
        };
      }

      const { parsed, rawResponse } = await parseMedicinesFromOcrText(rawText);
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
        cleanedText: rawText,
        parseStatus: medications.length > 0 ? "parsed" : "failed",
        medications,
        cardData: buildMedicineCardData(
          medications,
          medications.length > 0 ? ocrQuality : "low",
          warnings.length > 0 ? warnings : medications.length > 0 ? [] : [SAFE_LOW_QUALITY_MESSAGE],
          rawText
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
          error: medications.length > 0 ? undefined : "Gemini did not return any valid medicines from the OCR text.",
          raw_text_preview: rawText.slice(0, 500),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Prescription decoding failed";
      return {
        rawText,
        cleanedText: rawText,
        parseStatus: "failed",
        medications: [],
        cardData: buildMedicineCardData([], "low", [SAFE_LOW_QUALITY_MESSAGE], rawText),
        aiProvider: "gemini",
        aiModel: env.GEMINI_MODEL,
        providerMetadata: {
          provider: "vision_gemini",
          ocr_engine: "google-cloud-vision",
          ai_engine: "google-genai-gemini",
          error: SAFE_LOW_QUALITY_MESSAGE,
          root_error: message,
          raw_text_preview: rawText.slice(0, 500),
        },
      };
    }
  }
}
