import { Type } from "@google/genai";
import type { OcrParsedMedication } from "./ocr-provider";

export const MEDGEMMA_SYSTEM_INSTRUCTION = `You are MedGemma 1.5, a specialized medical language model for Renomedy.
Your task is to structure OCR text from Indian medical prescriptions into clean JSON.

Rules:
1. Identify all medications, doses, frequencies, and durations.
2. Expand Indian medical abbreviations (OD, BD, TDS, HS, SOS, AC, PC).
3. If a field is ambiguous, mark confidence low and needsReview=true.
4. Do not hallucinate or suggest treatments.
5. duration field should contain the extracted duration as text (e.g. "5 days", "1 week").
6. confidence must be 0.0-1.0.

Return a JSON array of medications.`;

export const MEDGEMMA_SCHEMA = {
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
      duration: { type: Type.STRING },
      instructions: { type: Type.STRING },
      confidence: { type: Type.NUMBER },
      needsReview: { type: Type.BOOLEAN }
    },
    required: ["name", "confidence", "needsReview"]
  }
};

export function extractJsonPayload(rawText: string): any[] {
  const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Fall through to best-effort JSON extraction.
  }

  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error("MedGemma returned malformed JSON for prescription parsing");
  }

  return JSON.parse(match[0]) as any[];
}

export function mapMedGemmaToParsedMedication(medicine: any): OcrParsedMedication {
  const confidenceScore = Math.max(0, Math.min(1, Number(medicine.confidence) || 0.5));
  const strength = String(medicine.strength ?? "").trim();
  const dose = String(medicine.dose ?? "").trim();
  const frequency = String(medicine.frequency ?? "").trim();
  const foodTiming = String(medicine.foodTiming ?? "").trim();
  const instructions = String(medicine.instructions ?? "").trim();
  const duration = String(medicine.duration ?? "").trim();

  return {
    medicineName: String(medicine.name ?? "").trim(),
    strength,
    dosage: dose || strength,
    frequency,
    timing: foodTiming,
    duration,
    instructions,
    confidence: confidenceScore >= 0.85 ? "high" : confidenceScore >= 0.65 ? "medium" : "low",
    shorthandDetected: frequency ? [frequency] : [],
    shorthandExplanation: String(medicine.frequencyMeaning ?? "").trim() || undefined,
    confidenceScore,
    requiresManualVerification:
      Boolean(medicine.needsReview) || !medicine.name || !frequency || confidenceScore < 0.7
  };
}
