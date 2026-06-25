import { env } from "../../config/env";
import { GoogleGenAI } from "@google/genai";
import type { OcrParseResult, OcrProvider } from "./ocr-provider";
import { buildMedicineCardData, SAFE_LOW_QUALITY_MESSAGE } from "./gemini-prescription-parse";
import {
  MEDGEMMA_SCHEMA,
  MEDGEMMA_SYSTEM_INSTRUCTION,
  mapMedGemmaToParsedMedication
} from "./medgemma-prescription-parse";

export class MlKitMedGemmaProvider implements OcrProvider {
  /**
   * This provider expects that OCR might have already been performed on the client (ML Kit).
   * For the two-step target architecture, this is primarily called from an endpoint that
   * provides the extracted text.
   */
  async parsePrescription(imageBuffer: Buffer, metadata?: Record<string, unknown>): Promise<OcrParseResult> {
    const extractedText = metadata?.extractedText as string | undefined;

    if (!extractedText) {
      return {
        rawText: "",
        cleanedText: "",
        parseStatus: "failed",
        medications: [],
        aiProvider: "medgemma",
        aiModel: "medgemma-1.5",
        cardData: buildMedicineCardData([], "low", [SAFE_LOW_QUALITY_MESSAGE], ""),
        providerMetadata: {
          provider: "mlkit_medgemma",
          failure_reason: "missing_ocr_text",
          error: "ML Kit OCR text was not provided to the MedGemma provider."
        }
      };
    }

    try {
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is required for MedGemma simulation");
      }

      const client = new GoogleGenAI({ apiKey });
      const response = await client.models.generateContent({
        model: "gemini-1.5-pro",
        contents: [{ role: "user", parts: [{ text: `${MEDGEMMA_SYSTEM_INSTRUCTION}\n\nTEXT:\n${extractedText}` }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: MEDGEMMA_SCHEMA as any
        }
      });

      const rawResponse = response.text ?? "[]";
      const parsed = JSON.parse(rawResponse);
      const medicines = Array.isArray(parsed)
        ? parsed.map(mapMedGemmaToParsedMedication).filter((m) => m.medicineName)
        : [];

      return {
        rawText: extractedText,
        cleanedText: extractedText,
        parseStatus: medicines.length > 0 ? "parsed" : "failed",
        medications: medicines,
        cardData: buildMedicineCardData(
          medicines,
          medicines.length > 0 ? "high" : "low",
          medicines.length > 0 ? [] : [SAFE_LOW_QUALITY_MESSAGE],
          extractedText
        ),
        aiProvider: "medgemma",
        aiModel: "medgemma-1.5",
        rawModelResponse: rawResponse,
        providerMetadata: {
          provider: "mlkit_medgemma",
          ai_engine: "google-medgemma",
          ocr_source: "mlkit-mobile"
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "MedGemma parsing failed";
      return {
        rawText: extractedText,
        cleanedText: extractedText,
        parseStatus: "failed",
        medications: [],
        aiProvider: "medgemma",
        aiModel: "medgemma-1.5",
        cardData: buildMedicineCardData([], "low", [SAFE_LOW_QUALITY_MESSAGE], extractedText),
        providerMetadata: {
          provider: "mlkit_medgemma",
          failure_reason: "medgemma_error",
          error: message
        }
      };
    }
  }
}
