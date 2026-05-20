import { GoogleGenAI } from "@google/genai";
import type { OcrCardData, OcrParsedMedication } from "./ocr-provider";

type GeminiMedicinePayload = {
  medicine_name?: string;
  generic_name?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  confidence?: "high" | "medium" | "low" | string;
};

export type GeminiPrescriptionPayload = {
  medicines?: GeminiMedicinePayload[];
  warnings?: string[];
  ocr_quality?: "high" | "medium" | "low" | string;
};

export const SAFE_LOW_QUALITY_MESSAGE = "We could not clearly read this prescription. Please upload a clearer image.";

const NON_MEDICINE_NAME_PATTERN =
  /^(?:once daily|twice daily|three times daily|four times daily|as needed|bedtime|before food|after food|before breakfast|after breakfast|morning|afternoon|evening|night|daily|take|food|prescription|review|follow up|for \d+ (?:day|days|week|weeks|month|months)|\d-\d-\d|\d\/\d\/\d|od|bd|tds|tid|qid|hs|ac|pc|sos|stat)$/i;

export function normalizeWhitespace(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

export function cleanOcrText(text: string) {
  return (text || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

function normalizeConfidence(value: unknown): "high" | "medium" | "low" {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "low";
}

function confidenceToScore(value: "high" | "medium" | "low") {
  if (value === "high") return 0.9;
  if (value === "medium") return 0.65;
  return 0.4;
}

function normalizeMedicineNameCandidate(value: string | null | undefined) {
  let candidate = normalizeWhitespace(value);
  if (!candidate) return "";

  candidate = candidate.replace(/^\s*(?:rx|r\/x)\s*/i, "");
  candidate = candidate.replace(/^\s*\d+[\).\-\s]+/, "");
  candidate = candidate
    .replace(/\b(?:tab(?:let)?|cap(?:sule)?|syp|syrup|inj|injection|drop|drops|cream|ointment|gel|lotion|spray)\b/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|gm|ml|iu|units?)\b/gi, " ")
    .replace(/\b(?:od|bd|tds|tid|qid|hs|sos|stat|qam|qpm|q\d+h|\d-\d-\d|\d\/\d\/\d)\b/gi, " ")
    .replace(/\b(?:ac|pc|before food|after food|before breakfast|after breakfast|morning|afternoon|evening|night|bedtime)\b/gi, " ")
    .replace(/\b(?:x\s*)?\d+\s*(?:day|days|week|weeks|month|months)\b/gi, " ")
    .replace(/[^A-Za-z0-9\-/+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-/,. ]+|[-/,. ]+$/g, "");

  const words = candidate.split(" ").filter(Boolean);
  return words.length > 5 ? words.slice(0, 5).join(" ") : candidate;
}

function isLikelyMedicineName(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length < 3) return false;
  if (!/[A-Za-z]/.test(normalized)) return false;
  if (NON_MEDICINE_NAME_PATTERN.test(normalized)) return false;
  if (/^(?:dr|doctor|patient|name|age|sex|date|address|phone|mobile|hospital|clinic|diagnosis|complaint|advice)\b/i.test(normalized)) {
    return false;
  }
  return true;
}

function sanitizeMedicineName(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value);
  const candidate = normalizeMedicineNameCandidate(normalized);
  if (candidate && isLikelyMedicineName(candidate)) {
    return candidate;
  }
  if (isLikelyMedicineName(normalized)) {
    return normalized;
  }
  // Preserve a readable fallback name when Gemini returns a plausible medicine
  // string that our stricter candidate sanitizer over-normalizes away.
  const salvageCandidate = normalized
    .replace(/^\s*(?:rx|r\/x)\s*/i, "")
    .replace(/^\s*\d+[\).\-\s]+/, "")
    .replace(/[^A-Za-z0-9()[\]/+ .-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (isLikelyMedicineName(salvageCandidate)) {
    const words = salvageCandidate.split(" ").filter(Boolean);
    return words.length > 8 ? words.slice(0, 8).join(" ") : salvageCandidate;
  }
  return "";
}

function normalizeFrequency(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value);
  const lower = normalized.toLowerCase();
  if (!lower) return "";
  if (lower === "od") return "Once daily";
  if (lower === "bd") return "Twice daily";
  if (lower === "tds" || lower === "tid") return "Three times daily";
  if (lower === "qid") return "Four times daily";
  if (lower === "hs") return "Bedtime";
  if (lower === "sos") return "As needed";
  return normalized;
}

export function assessOcrQuality(text: string): "high" | "medium" | "low" {
  const cleaned = cleanOcrText(text);
  if (cleaned.length < 15) return "low";

  const alnumCount = (cleaned.match(/[A-Za-z0-9]/g) ?? []).length;
  const medicineSignals = (cleaned.match(/\b(?:tab|tablet|cap|capsule|mg|mcg|ml|syrup|od|bd|tds|hs|sos|ac|pc)\b/gi) ?? []).length;
  const score = alnumCount + medicineSignals * 12;

  if (score >= 180) return "high";
  if (score >= 60) return "medium";
  return "low";
}

export function buildGeminiMedicinePrompt(ocrText: string) {
  const truncatedText = ocrText.length <= 3000 ? ocrText : `${ocrText.slice(0, 3000)}\n[... document truncated for processing ...]`;

  return [
    "You are analyzing OCR text extracted from a handwritten medical prescription.",
    "",
    "Your tasks:",
    "identify medicines",
    "correct OCR spelling mistakes",
    "extract dosage",
    "extract frequency",
    "extract duration",
    "extract notes if available",
    "",
    "Ignore:",
    "signatures",
    "doctor stamps",
    "addresses",
    "phone numbers",
    "random OCR noise",
    "",
    "VERY IMPORTANT:",
    "Do NOT hallucinate medicines",
    "Only include medicines reasonably visible in OCR",
    "If uncertain, mark confidence low",
    "",
    "Return STRICT JSON only.",
    "",
    "Required JSON schema:",
    "{",
    '  "medicines": [',
    "    {",
    '      "medicine_name": "",',
    '      "generic_name": "",',
    '      "dosage": "",',
    '      "frequency": "",',
    '      "duration": "",',
    '      "instructions": "",',
    '      "confidence": ""',
    "    }",
    "  ],",
    '  "warnings": [],',
    '  "ocr_quality": ""',
    "}",
    "",
    "OCR TEXT:",
    truncatedText,
  ].join("\n");
}

export function extractJsonPayload(rawText: string): GeminiPrescriptionPayload {
  const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as GeminiPrescriptionPayload;
    }
  } catch {
    // Fall through to best-effort JSON extraction.
  }

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Gemini returned malformed JSON for prescription parsing");
  }

  return JSON.parse(match[0]) as GeminiPrescriptionPayload;
}

export async function parseMedicinesFromOcrText(ocrText: string) {
  const { env } = await import("../../config/env");
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for prescription decoding");
  }
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const response = await client.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: buildGeminiMedicinePrompt(ocrText) }],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  const rawResponse = response.text?.trim();
  if (!rawResponse) {
    throw new Error("Gemini returned an empty response");
  }

  return {
    parsed: extractJsonPayload(rawResponse),
    rawResponse,
  };
}

export function mapMedicinesToParseResult(medicines: GeminiMedicinePayload[]): OcrParsedMedication[] {
  const dedupe = new Set<string>();
  const parsedMedications: OcrParsedMedication[] = [];

  for (const medicine of medicines) {
    const medicineName = sanitizeMedicineName(medicine.medicine_name);
    if (!medicineName) continue;

    const key = medicineName.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!key || dedupe.has(key)) continue;
    dedupe.add(key);

    const confidence = normalizeConfidence(medicine.confidence);
    parsedMedications.push({
      medicineName,
      genericName: normalizeWhitespace(medicine.generic_name) || undefined,
      dosage: normalizeWhitespace(medicine.dosage) || undefined,
      strength: normalizeWhitespace(medicine.dosage) || undefined,
      frequency: normalizeFrequency(medicine.frequency) || undefined,
      duration: normalizeWhitespace(medicine.duration) || undefined,
      instructions: normalizeWhitespace(medicine.instructions) || undefined,
      shorthandDetected: [],
      confidence,
      confidenceScore: confidenceToScore(confidence),
      requiresManualVerification: confidence !== "high",
    });
  }

  return parsedMedications;
}

export function buildMedicineCardData(
  medications: OcrParsedMedication[],
  ocrQuality: "high" | "medium" | "low",
  warnings: string[],
  rawText: string
): OcrCardData {
  const averageConfidence =
    medications.length > 0
      ? Number((medications.reduce((sum, medicine) => sum + medicine.confidenceScore, 0) / medications.length).toFixed(3))
      : 0;

  return {
    status: medications.length > 0 ? "success" : "failed",
    ocr_quality: ocrQuality,
    prescription_summary: {
      total_medicines: medications.length,
      confidence_score: averageConfidence,
    },
    medicines: medications.map((medicine, index) => ({
      id: index + 1,
      medicine_name: medicine.medicineName,
      generic_name: medicine.genericName ?? "",
      strength: medicine.dosage ?? medicine.strength ?? "",
      form: "",
      dose: "",
      frequency: medicine.frequency ?? "",
      timing: "",
      duration: medicine.duration ?? "",
      instructions: medicine.instructions ?? "",
      uses: [],
      warnings: [],
      quantity: "",
      confidence: medicine.confidence ?? "low",
    })),
    important_notes: warnings,
    raw_detected_text_summary: rawText.slice(0, 500) || SAFE_LOW_QUALITY_MESSAGE,
  };
}
