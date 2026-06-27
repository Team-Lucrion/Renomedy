import { confidenceEngine } from "../../utils/confidenceEngine";
import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";
import { env } from "../../config/env";
import type { OcrParseResult, OcrProvider } from "./ocr-provider";
import {
  SAFE_LOW_QUALITY_MESSAGE,
  buildGroqMedicineCardData,
  mapGroqMedicinesToParseResult,
  parseMedicinesWithGroq
} from "./groq-prescription-parse";

function cleanOcrText(text: string) {
  return (text || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

type PreparedImageVariant = {
  label: string;
  buffer: Buffer;
};

type OcrCandidate = {
  label: string;
  rawText: string;
  cleanedText: string;
  confidence: number;
  score: number;
};

function countMatches(value: string, pattern: RegExp) {
  return (value.match(pattern) ?? []).length;
}

function scoreOcrText(cleanedText: string, confidence: number) {
  if (!cleanedText) return 0;

  const lines = cleanedText.split("\n").map((line) => line.trim()).filter(Boolean);
  const alphaCount = countMatches(cleanedText, /[A-Za-z]/g);
  const digitCount = countMatches(cleanedText, /\d/g);
  const medicineHints = countMatches(cleanedText, /\b(?:tab|tablet|cap|capsule|syp|syrup|mg|mcg|ml|od|bd|tds|tid|qid|hs|sos|ac|pc)\b/gi);
  const wordCount = countMatches(cleanedText, /\b[A-Za-z]{2,}\b/g);
  const noisySymbolCount = countMatches(cleanedText, /[@#$%^&*_=`~<>|{}[\]]/g);
  const shortLines = lines.filter((line) => line.length > 0 && line.length < 4).length;
  const alphaRatio = alphaCount / Math.max(cleanedText.length, 1);
  const wordRatio = wordCount / Math.max(lines.length, 1);

  return (
    confidence * 120 +
    alphaCount * 0.4 +
    digitCount * 0.15 +
    medicineHints * 18 +
    wordCount * 6 +
    alphaRatio * 40 +
    wordRatio * 3 -
    noisySymbolCount * 4 -
    shortLines * 2
  );
}

function isTextReadable(cleanedText: string, confidence: number) {
  if (!cleanedText || cleanedText.length < 20) return false;

  const alphaCount = countMatches(cleanedText, /[A-Za-z]/g);
  const wordCount = countMatches(cleanedText, /\b[A-Za-z]{2,}\b/g);
  const medicineHints = countMatches(cleanedText, /\b(?:tab|tablet|cap|capsule|mg|mcg|ml|od|bd|tds|tid|qid|hs|sos|ac|pc)\b/gi);
  const noisySymbolCount = countMatches(cleanedText, /[@#$%^&*_=`~<>|{}[\]]/g);
  const alphaRatio = alphaCount / Math.max(cleanedText.length, 1);

  return (
    confidence >= 0.25 &&
    alphaCount >= 18 &&
    wordCount >= 4 &&
    alphaRatio >= 0.45 &&
    noisySymbolCount <= 12 &&
    (medicineHints >= 1 || cleanedText.length >= 45)
  );
}

async function buildPreparedVariants(imageBuffer: Buffer): Promise<PreparedImageVariant[]> {
  const base = sharp(imageBuffer, { failOn: "none" }).rotate();
  const metadata = await base.metadata();
  const width = metadata.width ?? 0;

  const targetWidth = width > 0 && width < 1800 ? 1800 : width > 2400 ? 2200 : undefined;
  const normalized = targetWidth
    ? base.resize({ width: targetWidth, withoutEnlargement: false, fit: "inside" })
    : base.clone();

  const grayscale = normalized.clone().grayscale().normalize();

  const variants: PreparedImageVariant[] = [
    {
      label: "grayscale-normalized",
      buffer: await grayscale.clone().png().toBuffer()
    },
    {
      label: "threshold-160",
      buffer: await grayscale.clone().threshold(160).png().toBuffer()
    },
    {
      label: "threshold-185",
      buffer: await grayscale.clone().threshold(185).png().toBuffer()
    },
    {
      label: "sharpened",
      buffer: await grayscale.clone().sharpen().png().toBuffer()
    }
  ];

  return variants;
}


export class TesseractGroqOcrProvider implements OcrProvider {
  async parsePrescription(imageBuffer: Buffer, _metadata?: Record<string, unknown>): Promise<OcrParseResult> {
    const worker = await createWorker("eng");
    let rawText = "";
    let ocrConfidence = 0;

    try {
      const variants = await buildPreparedVariants(imageBuffer);
      const candidates: OcrCandidate[] = [];

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1"
      });

      for (const variant of variants) {
        const { data } = await worker.recognize(variant.buffer);
        const candidateRawText = data.text ?? "";
        const candidateCleanedText = cleanOcrText(candidateRawText);
        const candidateConfidence =
          typeof data.confidence === "number" ? Math.max(0, Math.min(1, data.confidence / 100)) : 0;

        candidates.push({
          label: variant.label,
          rawText: candidateRawText,
          cleanedText: candidateCleanedText,
          confidence: candidateConfidence,
          score: scoreOcrText(candidateCleanedText, candidateConfidence)
        });
      }

      candidates.sort((left, right) => right.score - left.score);
      const bestCandidate = candidates[0];

      rawText = bestCandidate?.rawText ?? "";
      ocrConfidence = bestCandidate?.confidence ?? 0;

      const cleanedText = bestCandidate?.cleanedText ?? "";
      const readableText = isTextReadable(cleanedText, ocrConfidence);

      if (!readableText) {
        return {
          rawText: "",
          cleanedText: "",
          parseStatus: "failed",
          medications: [],
          cardData: buildGroqMedicineCardData([], [SAFE_LOW_QUALITY_MESSAGE], ""),
          aiProvider: "groq",
          aiModel: env.GROQ_MODEL,
          providerMetadata: {
            provider: "tesseract_groq",
            ocr_engine: "tesseract.js",
            failure_reason: "low_quality_text",
            error: SAFE_LOW_QUALITY_MESSAGE,
            ocr_confidence: ocrConfidence,
            preprocess_variants: candidates.map((candidate) => ({
              label: candidate.label,
              confidence: candidate.confidence,
              score: Number(candidate.score.toFixed(2))
            })),
            best_variant: bestCandidate?.label,
            raw_text_preview: cleanedText.slice(0, 300)
          }
        };
      }

      const { parsed, rawResponse } = await parseMedicinesWithGroq(cleanedText);
      const warnings = (Array.isArray(parsed.warnings) ? parsed.warnings : [])
        .map((warning) => String(warning).trim())
        .filter(Boolean);
      const medications = mapGroqMedicinesToParseResult(Array.isArray(parsed.medicines) ? parsed.medicines : []).map((med) => {
        const confidenceResult = confidenceEngine.evaluate({ medicine: med, ocrQuality: "medium" });
        med.confidenceScore = confidenceResult.confidenceScore;
        med.confidenceLevel = confidenceResult.confidenceLevel;
        med.requiresManualVerification = confidenceResult.verificationRequired;
        med.confidenceReasons = confidenceResult.confidenceReasons;
        return med;
      });

      return {
        rawText,
        cleanedText,
        parseStatus: medications.length > 0 ? "parsed" : "failed",
        medications,
        cardData: buildGroqMedicineCardData(
          medications,
          warnings.length > 0 ? warnings : medications.length > 0 ? [] : ["Text was extracted, but medicines could not be parsed safely."],
          cleanedText
        ),
        aiProvider: "groq",
        aiModel: env.GROQ_MODEL,
        rawModelResponse: rawResponse,
        providerMetadata: {
          provider: "tesseract_groq",
          ocr_engine: "tesseract.js",
          ai_engine: "groq",
          ocr_confidence: ocrConfidence,
          best_variant: bestCandidate?.label,
          warnings,
          parse_status: medications.length > 0 ? "parsed" : "failed",
          failure_reason: medications.length > 0 ? undefined : "no_medicines_parsed",
          error: medications.length > 0 ? undefined : "Text was extracted, but medicines could not be parsed safely."
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Prescription decoding failed";
      const cleanedText = cleanOcrText(rawText);
      return {
        rawText,
        cleanedText,
        parseStatus: "failed",
        medications: [],
        cardData: buildGroqMedicineCardData([], [SAFE_LOW_QUALITY_MESSAGE], cleanedText),
        aiProvider: "groq",
        aiModel: env.GROQ_MODEL,
        providerMetadata: {
          provider: "tesseract_groq",
          ocr_engine: "tesseract.js",
          ai_engine: "groq",
          failure_reason: rawText ? "parse_error" : "ocr_pipeline_error",
          error: message,
          ocr_confidence: ocrConfidence
        }
      };
    } finally {
      await worker.terminate();
    }
  }
}
