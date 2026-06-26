import { env } from "../../../config/env";
import { AiProvider, AiParseResult } from "../ai-provider";
import { MedGemmaService } from "./medgemma.service";
import {
  SAFE_LOW_QUALITY_MESSAGE,
  assessOcrQuality,
  buildMedicineCardData,
  cleanOcrText,
  mapMedicinesToParseResult,
  normalizeWhitespace,
} from "../../ocr/gemini-prescription-parse";

export class MedGemmaAiProvider implements AiProvider {
  private service: MedGemmaService;

  constructor() {
    this.service = new MedGemmaService();
  }

  async processPrescription(ocrText: string, ocrMetadata?: Record<string, unknown>, segmentation?: Record<string, unknown>): Promise<AiParseResult> {
    const cleanedText = cleanOcrText(ocrText);

    if (!cleanedText || cleanedText.length < 15) {
      return {
        rawText: ocrText,
        cleanedText,
        parseStatus: "failed",
        medications: [],
        cardData: buildMedicineCardData([], "low", [SAFE_LOW_QUALITY_MESSAGE], cleanedText),
        aiProvider: "medgemma",
        aiModel: env.MEDGEMMA_MODEL,
        providerMetadata: {
          provider: "medgemma_ai",
          failure_reason: "no_text_detected",
          error: "Provided OCR text did not contain enough readable prescription text.",
          raw_text_preview: cleanedText.slice(0, 500),
          ocr_metadata: ocrMetadata,
          segmentation,
        },
      };
    }

    try {
      const { payload, rawResponse } = await this.service.extractMedicines(cleanedText);
      // payload.medicines is an array of medGemmaMedicineSchema, which is structurally compatible with GeminiMedicinePayload
      const mappedMedicines = (Array.isArray(payload.medicines) ? payload.medicines : []) as any;
      const medications = mapMedicinesToParseResult(mappedMedicines);
      const warnings = (Array.isArray(payload.warnings) ? payload.warnings : [])
        .map((warning: string) => normalizeWhitespace(warning))
        .filter(Boolean);

      const modelQuality =
        payload.ocr_quality === "high" || payload.ocr_quality === "medium" || payload.ocr_quality === "low"
          ? payload.ocr_quality
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
        aiProvider: "medgemma",
        aiModel: env.MEDGEMMA_MODEL,
        rawModelResponse: rawResponse,
        providerMetadata: {
          provider: "medgemma_ai",
          ai_engine: "self-hosted-medgemma",
          warnings,
          parse_status: medications.length > 0 ? "parsed" : "failed",
          failure_reason: medications.length > 0 ? undefined : "no_medicines_parsed",
          error: medications.length > 0 ? undefined : "MedGemma did not return any valid medicines from the OCR text.",
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
        aiProvider: "medgemma",
        aiModel: env.MEDGEMMA_MODEL,
        providerMetadata: {
          provider: "medgemma_ai",
          ai_engine: "self-hosted-medgemma",
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
