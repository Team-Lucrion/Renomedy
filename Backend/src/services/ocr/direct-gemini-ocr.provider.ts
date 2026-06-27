import { confidenceEngine } from "../../utils/confidenceEngine";
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../../config/env";
import type { OcrParseResult, OcrParsedMedication, OcrProvider } from "./ocr-provider";
import { SAFE_LOW_QUALITY_MESSAGE, buildMedicineCardData } from "./gemini-prescription-parse";

type GeminiMedicine = {
  name?: string;
  strength?: string;
  dose?: string;
  frequency?: string;
  frequencyMeaning?: string;
  foodTiming?: string;
  durationDays?: number | null;
  instructions?: string;
  confidence?: number;
  needsReview?: boolean;
};

const MEDICINE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      strength: { type: Type.STRING },
      dose: { type: Type.STRING },
      frequency: { type: Type.STRING },
      frequencyMeaning: { type: Type.STRING },
      foodTiming: { type: Type.STRING },
      durationDays: { type: Type.NUMBER },
      instructions: { type: Type.STRING },
      confidence: { type: Type.NUMBER },
      needsReview: { type: Type.BOOLEAN }
    },
    required: ["name", "confidence", "needsReview"]
  }
};

const SYSTEM_INSTRUCTION = `You are a prescription parsing engine for Renomedy, an Indian family medication app.
Extract all medicines visible in the prescription image.
Rules:
- Never diagnose, recommend treatment, change doses, or suggest substitutions.
- Mark needsReview=true for any uncertain medicine or field.
- durationDays must be null if duration is not visible.
- confidence must be between 0.0 and 1.0.
- Expand common prescription abbreviations in frequencyMeaning, such as OD, BD, TDS, SOS, HS, AC, and PC.
- Return only structured medicine extraction data.`;

function cleanText(value: string) {
  return value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function toConfidenceLabel(score: number): "high" | "medium" | "low" {
  if (score >= 0.85) return "high";
  if (score >= 0.65) return "medium";
  return "low";
}

function toParsedMedication(medicine: GeminiMedicine): OcrParsedMedication {
  const confidenceScore = Math.max(0, Math.min(1, Number(medicine.confidence) || 0.5));
  const strength = String(medicine.strength ?? "").trim();
  const dose = String(medicine.dose ?? "").trim();
  const frequency = String(medicine.frequency ?? "").trim();
  const foodTiming = String(medicine.foodTiming ?? "").trim();
  const instructions = String(medicine.instructions ?? "").trim();
  const durationDays = medicine.durationDays == null || Number.isNaN(Number(medicine.durationDays))
    ? null
    : Number(medicine.durationDays);

  return {
    medicineName: String(medicine.name ?? "").trim(),
    strength,
    dosage: dose || strength,
    frequency,
    timing: foodTiming,
    duration: durationDays == null ? "" : `${durationDays} days`,
    instructions,
    confidence: toConfidenceLabel(confidenceScore),
    shorthandDetected: frequency ? [frequency] : [],
    shorthandExplanation: String(medicine.frequencyMeaning ?? "").trim() || undefined,
    confidenceScore,
    requiresManualVerification:
      Boolean(medicine.needsReview) || !medicine.name || !frequency || confidenceScore < 0.7
  };
}


export class DirectGeminiOcrProvider implements OcrProvider {
  async parsePrescription(imageBuffer: Buffer, _metadata?: Record<string, unknown>): Promise<OcrParseResult> {
    if (!env.GEMINI_API_KEY) {
      return {
        rawText: "",
        cleanedText: "",
        parseStatus: "failed",
        medications: [],
        aiProvider: "gemini",
        aiModel: env.GEMINI_MODEL,
        cardData: buildMedicineCardData([], "low", [SAFE_LOW_QUALITY_MESSAGE], ""),
        providerMetadata: {
          provider: "direct_gemini",
          failure_reason: "missing_gemini_api_key",
          error: "GEMINI_API_KEY is not configured."
        }
      };
    }

    const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

    try {
      const response = await client.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${SYSTEM_INSTRUCTION}\n\nExtract every medicine from this prescription image. Return only the JSON array matching the schema.`
              },
              {
                inlineData: {
                  data: imageBuffer.toString("base64"),
                  mimeType: "image/jpeg"
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: MEDICINE_SCHEMA as any
        }
      });

      const rawResponse = response.text ?? "[]";
      const parsed = JSON.parse(rawResponse) as unknown;
      const medicines = Array.isArray(parsed)
        ? parsed.map((m) => {
            const med = toParsedMedication(m);
            if (!med.medicineName) return med;
            const confidenceResult = confidenceEngine.evaluate({ medicine: med, ocrQuality: "medium" });
            med.confidenceScore = confidenceResult.confidenceScore;
            med.confidenceLevel = confidenceResult.confidenceLevel;
            med.requiresManualVerification = confidenceResult.verificationRequired;
            med.confidenceReasons = confidenceResult.confidenceReasons;
            return med;
          }).filter((medicine) => medicine.medicineName)
        : [];
      const cleanedText = cleanText(
        medicines
          .map((medicine) =>
            [
              medicine.medicineName,
              medicine.strength,
              medicine.dosage,
              medicine.frequency,
              medicine.timing,
              medicine.duration,
              medicine.instructions
            ]
              .filter(Boolean)
              .join(" ")
          )
          .join("\n")
      );

      return {
        rawText: cleanedText || "[extracted via Gemini Vision]",
        cleanedText,
        parseStatus: medicines.length > 0 ? "parsed" : "failed",
        medications: medicines,
        cardData: buildMedicineCardData(
          medicines,
          medicines.length > 0 ? "medium" : "low",
          medicines.some((medicine) => medicine.requiresManualVerification)
            ? ["Some medicines have low confidence and require verification."]
            : medicines.length > 0
              ? []
              : [SAFE_LOW_QUALITY_MESSAGE],
          cleanedText
        ),
        aiProvider: "gemini",
        aiModel: env.GEMINI_MODEL,
        rawModelResponse: rawResponse,
        providerMetadata: {
          provider: "direct_gemini",
          ai_engine: "google-genai-gemini-vision",
          parse_status: medicines.length > 0 ? "parsed" : "failed",
          failure_reason: medicines.length > 0 ? undefined : "no_medicines_parsed",
          error: medicines.length > 0 ? undefined : "Gemini did not return any valid medicines from the image."
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gemini Vision extraction failed";
      return {
        rawText: "",
        cleanedText: "",
        parseStatus: "failed",
        medications: [],
        aiProvider: "gemini",
        aiModel: env.GEMINI_MODEL,
        cardData: buildMedicineCardData([], "low", [SAFE_LOW_QUALITY_MESSAGE], ""),
        providerMetadata: {
          provider: "direct_gemini",
          ai_engine: "google-genai-gemini-vision",
          failure_reason: "gemini_vision_error",
          error: message
        }
      };
    }
  }
}
