import { env } from "../../config/env";
import type { OcrCardData, OcrParsedMedication } from "./ocr-provider";

type GroqMedicinePayload = {
  name?: string;
  strength?: string;
  dose?: string;
  frequency?: string;
  frequencyMeaning?: string;
  timing?: string;
  foodTiming?: string;
  durationDays?: number | null;
  instructions?: string;
  confidence?: number;
  needsReview?: boolean;
};

type GroqPrescriptionPayload = {
  medicines?: GroqMedicinePayload[];
  warnings?: string[];
};

export const SAFE_LOW_QUALITY_MESSAGE =
  "We could not read this prescription clearly. Please retake the photo or enter details manually.";

function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeFrequencyMeaning(frequency: string, frequencyMeaning?: string) {
  const normalizedFrequency = normalizeWhitespace(frequency).toLowerCase();
  const explicit = normalizeWhitespace(frequencyMeaning);

  if (explicit) {
    return explicit;
  }

  if (normalizedFrequency === "od") return "once daily";
  if (normalizedFrequency === "bd") return "twice daily";
  if (normalizedFrequency === "tds" || normalizedFrequency === "tid") return "three times daily";
  if (normalizedFrequency === "qid") return "four times daily";
  if (normalizedFrequency === "hs") return "at bedtime";
  if (normalizedFrequency === "sos") return "as needed";

  return "";
}

function buildPrompt(ocrText: string) {
  const truncatedText =
    ocrText.length <= 3000 ? ocrText : `${ocrText.slice(0, 3000)}\n[... document truncated for processing ...]`;

  return [
    "You analyze OCR text from a medical prescription.",
    "Return strict JSON only. No markdown. No prose. No code fences.",
    "Do not diagnose. Do not recommend dosage changes. Do not suggest substitutions.",
    "Only extract medicines that are reasonably visible in the OCR text.",
    "If any field is uncertain, keep it empty and set needsReview true.",
    "Use confidence as a decimal from 0 to 1.",
    "Extract timing and foodTiming as separate fields.",
    "timing means when in the day: morning, afternoon, evening, night, bedtime, immediately, as needed.",
    "foodTiming means relation to food: before food, after food, with food, no food instruction.",
    "Do not put food instructions in timing. Do not put morning/night/bedtime in foodTiming.",
    "Return this exact schema:",
    "{",
    '  "medicines": [',
    "    {",
    '      "name": "",',
    '      "strength": "",',
    '      "dose": "",',
    '      "frequency": "",',
    '      "frequencyMeaning": "",',
    '      "timing": "",',
    '      "foodTiming": "",',
    '      "durationDays": 0,',
    '      "instructions": "",',
    '      "confidence": 0,',
    '      "needsReview": true',
    "    }",
    "  ],",
    '  "warnings": []',
    "}",
    "OCR TEXT:",
    truncatedText
  ].join("\n");
}

function isPrescriptionPayload(value: unknown): value is GroqPrescriptionPayload {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && "medicines" in value);
}

function extractAssistantContent(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return "";
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object" || Array.isArray(firstChoice)) {
    return "";
  }

  const message = (firstChoice as { message?: unknown }).message;
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return "";
  }

  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : "";
}

export function extractJsonPayload(rawText: string): GroqPrescriptionPayload {
  const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (isPrescriptionPayload(parsed)) {
      return parsed;
    }

    const assistantContent = extractAssistantContent(parsed);
    if (assistantContent) {
      return extractJsonPayload(assistantContent);
    }
  } catch {
    // fall through to best-effort extraction
  }

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Groq returned malformed JSON for prescription parsing");
  }

  const parsed = JSON.parse(match[0]) as unknown;
  if (isPrescriptionPayload(parsed)) {
    return parsed;
  }

  const assistantContent = extractAssistantContent(parsed);
  if (assistantContent) {
    return extractJsonPayload(assistantContent);
  }

  throw new Error("Groq returned JSON without prescription medicines");
}

export async function parseMedicinesWithGroq(ocrText: string) {
  if (!env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is required for prescription decoding");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      temperature: 0.1,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "You extract medicines from prescription OCR. Return valid JSON only with no markdown, no commentary, and no extra keys."
        },
        {
          role: "user",
          content: buildPrompt(ocrText)
        }
      ]
    })
  });

  const rawResponse = await response.text();

  if (!response.ok) {
    throw new Error(`Groq API error (${response.status})`);
  }

  return {
    parsed: extractJsonPayload(rawResponse),
    rawResponse
  };
}

export function mapGroqMedicinesToParseResult(medicines: GroqMedicinePayload[]): OcrParsedMedication[] {
  const dedupe = new Set<string>();
  const parsedMedications: OcrParsedMedication[] = [];

  for (const medicine of medicines) {
    const name = normalizeWhitespace(medicine.name);
    if (!name) continue;

    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!key || dedupe.has(key)) continue;
    dedupe.add(key);

    const frequency = normalizeWhitespace(medicine.frequency);
    const frequencyMeaning = normalizeFrequencyMeaning(frequency, medicine.frequencyMeaning);
    const timing = normalizeWhitespace(medicine.timing);
    const foodTiming = normalizeWhitespace(medicine.foodTiming);
    const instruction = normalizeWhitespace(medicine.instructions);
    const confidence =
      typeof medicine.confidence === "number" && Number.isFinite(medicine.confidence)
        ? Math.max(0, Math.min(1, medicine.confidence))
        : 0.5;
    const needsReview = typeof medicine.needsReview === "boolean" ? medicine.needsReview : confidence < 0.85;
    const durationDays =
      typeof medicine.durationDays === "number" && Number.isFinite(medicine.durationDays)
        ? Math.max(0, Math.round(medicine.durationDays))
        : null;

    parsedMedications.push({
      medicineName: name,
      strength: normalizeWhitespace(medicine.strength) || undefined,
      dosage: normalizeWhitespace(medicine.strength) || undefined,
      dose: normalizeWhitespace(medicine.dose) || undefined,
      frequency: frequency || undefined,
      timing: timing || undefined,
      foodTiming: foodTiming || undefined,
      duration: durationDays !== null && durationDays > 0 ? `${durationDays} days` : undefined,
      instructions: instruction || undefined,
      confidence: confidence >= 0.85 ? "high" : confidence >= 0.6 ? "medium" : "low",
      shorthandDetected: frequency ? [frequency] : [],
      shorthandExplanation: [frequencyMeaning, timing, foodTiming].filter(Boolean).join(", ") || undefined,
      confidenceScore: confidence,
      requiresManualVerification: needsReview
    });
  }

  return parsedMedications;
}

export function buildGroqMedicineCardData(
  medications: OcrParsedMedication[],
  warnings: string[],
  rawText: string
): OcrCardData {
  const averageConfidence =
    medications.length > 0
      ? Number((medications.reduce((sum, medicine) => sum + medicine.confidenceScore, 0) / medications.length).toFixed(3))
      : 0;

  return {
    status: medications.length > 0 ? "success" : "failed",
    ocr_quality: averageConfidence >= 0.85 ? "high" : averageConfidence >= 0.6 ? "medium" : "low",
    prescription_summary: {
      total_medicines: medications.length,
      confidence_score: averageConfidence
    },
    medicines: medications.map((medicine, index) => ({
      id: index + 1,
      medicine_name: medicine.medicineName,
      generic_name: medicine.genericName ?? "",
      strength: medicine.strength ?? medicine.dosage ?? "",
      form: medicine.form ?? "",
      dose: medicine.dose ?? "",
      frequency: medicine.frequency ?? "",
      timing: medicine.timing ?? "",
      duration: medicine.duration ?? "",
      instructions: medicine.instructions ?? "",
      uses: [],
      warnings: [],
      quantity: "",
      confidence: medicine.confidence ?? "low"
    })),
    important_notes: warnings,
    raw_detected_text_summary: rawText.slice(0, 500) || SAFE_LOW_QUALITY_MESSAGE
  };
}
