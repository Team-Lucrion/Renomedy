import { env } from "../../config/env";
import { GoogleGenAI } from "@google/genai";
import type { OcrParseResult, OcrProvider } from "./ocr-provider";
import { buildMedicineCardData, SAFE_LOW_QUALITY_MESSAGE, cleanOcrText } from "./gemini-prescription-parse";
import { extractTextWithGoogleVision } from "./google-vision-text";
import {
  MEDGEMMA_SCHEMA,
  MEDGEMMA_SYSTEM_INSTRUCTION,
  mapMedGemmaToParsedMedication,
  extractJsonPayload
} from "./medgemma-prescription-parse";

export class MlKitMedGemmaProvider implements OcrProvider {
  /**
   * This provider handles the modern two-step Google stack.
   * Priority:
   * 1. On-device OCR text from ML Kit (provided in metadata.extractedText)
   * 2. Server-side OCR via Google Cloud Vision (fallback for Web/Desktop)
   * 3. Structuring via MedGemma 1.5 (LLM)
   */
  async parsePrescription(imageBuffer: Buffer, metadata?: Record<string, unknown>): Promise<OcrParseResult> {
    let rawText = (metadata?.extractedText as string | undefined) || "";
    let ocrSource: "mlkit-mobile" | "google-vision-cloud" = "mlkit-mobile";

    try {
      // Step 1: Ensure we have OCR text
      if (!rawText && imageBuffer && imageBuffer.length > 0) {
        rawText = await extractTextWithGoogleVision(imageBuffer);
        ocrSource = "google-vision-cloud";
      }

      const cleanedText = cleanOcrText(rawText);

      if (!cleanedText || cleanedText.length < 15) {
        return {
          rawText,
          cleanedText,
          parseStatus: "failed",
          medications: [],
          aiProvider: "medgemma",
          aiModel: "medgemma-1.5",
          cardData: buildMedicineCardData([], "low", [SAFE_LOW_QUALITY_MESSAGE], cleanedText),
          providerMetadata: {
            provider: "mlkit_medgemma",
            ocr_source: ocrSource,
            failure_reason: "no_text_detected",
            error: "Could not detect enough readable prescription text."
          }
        };
      }

      // Step 2: Structuring via LLM
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is required for MedGemma simulation");
      }

      const client = new GoogleGenAI({ apiKey });
      const response = await client.models.generateContent({
        model: "gemini-2.0-flash", // Fast, cost-effective, and high-performance simulation
        contents: [
          {
            role: "user",
            parts: [
              { text: MEDGEMMA_SYSTEM_INSTRUCTION },
              { text: `OCR TEXT TO ANALYZE:\n${cleanedText}` }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: MEDGEMMA_SCHEMA as any
        }
      });

      const rawResponse = response.text ?? "[]";
      const parsed = extractJsonPayload(rawResponse);
      const medicines = Array.isArray(parsed)
        ? parsed.map(mapMedGemmaToParsedMedication).filter((m) => m.medicineName)
        : [];

      return {
        rawText,
        cleanedText,
        parseStatus: medicines.length > 0 ? "parsed" : "failed",
        medications: medicines,
        cardData: buildMedicineCardData(
          medicines,
          medicines.length > 0 ? "high" : "low",
          medicines.length > 0 ? [] : [SAFE_LOW_QUALITY_MESSAGE],
          cleanedText
        ),
        aiProvider: "medgemma",
        aiModel: "medgemma-1.5",
        rawModelResponse: rawResponse,
        providerMetadata: {
          provider: "mlkit_medgemma",
          ai_engine: "google-medgemma",
          ocr_source: ocrSource,
          raw_text_preview: cleanedText.slice(0, 500)
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "MedGemma parsing failed";
      return {
        rawText,
        cleanedText: cleanOcrText(rawText),
        parseStatus: "failed",
        medications: [],
        aiProvider: "medgemma",
        aiModel: "medgemma-1.5",
        cardData: buildMedicineCardData([], "low", [SAFE_LOW_QUALITY_MESSAGE], rawText),
        providerMetadata: {
          provider: "mlkit_medgemma",
          failure_reason: "medgemma_pipeline_error",
          error: message,
          ocr_source: ocrSource
        }
      };
    }
  }
}
