import { OcrParsedMedication } from "../services/ocr/ocr-provider";
import { findMedicineCatalogMatch } from "./medicineIntelligence";

export type VerificationLevel = "High Confidence" | "Review Recommended" | "Manual Verification Required";

export interface ConfidenceResult {
  confidenceScore: number;
  confidenceLevel: VerificationLevel;
  verificationRequired: boolean;
  confidenceReasons: string[];
}

export interface ConfidenceInput {
  medicine: OcrParsedMedication;
  ocrQuality?: "high" | "medium" | "low";
  aiValidationFailed?: boolean;
}

export class ConfidenceEngine {
  /**
   * Evaluates a parsed medication to determine its true confidence score and verification level.
   * Weighting:
   * Medicine Match: +30 verified, +15 probable, 0 unknown
   * Dosage: +25 valid, 0 missing
   * Timing/Frequency: +15 valid, 0 missing
   * OCR Quality: +15 high, +10 medium, 0 low
   * AI Validation: +15 valid, 0 failed
   */
  public evaluate(input: ConfidenceInput): ConfidenceResult {
    const { medicine, ocrQuality = "medium", aiValidationFailed = false } = input;
    let score = 0;
    const reasons: string[] = [];
    let requiresManualSafety = false;

    // 1. Medicine Match (+30 / +15 / 0)
    if (medicine.medicineName) {
      const match = findMedicineCatalogMatch({ medicineName: medicine.medicineName });
      if (match) {
        score += 30; // Catalog returns match only on high confidence
        reasons.push(`Medicine perfectly matched in catalog: ${match.brandName} (+30)`);
      } else {
        reasons.push("Medicine not found in catalog (0)");
      }
    } else {
      reasons.push("Missing medicine name (0)");
      requiresManualSafety = true;
    }

    // 2. Dosage (+25 / 0)
    if (medicine.dosage && medicine.dosage.trim().length > 0) {
      score += 25;
      reasons.push("Dosage extracted (+25)");
    } else if (medicine.strength && medicine.strength.trim().length > 0) {
      score += 25;
      reasons.push("Strength extracted (+25)");
    } else {
      reasons.push("Missing dosage/strength (0)");
      requiresManualSafety = true;
    }

    // 3. Timing / Frequency (+15 / 0)
    if ((medicine.frequency && medicine.frequency.trim().length > 0) ||
        (medicine.timing && medicine.timing.trim().length > 0)) {
      score += 15;
      reasons.push("Timing/Frequency extracted (+15)");
    } else {
      reasons.push("Missing timing/frequency (0)");
    }

    // 4. OCR Quality (+15 / +10 / 0)
    if (ocrQuality === "high") {
      score += 15;
      reasons.push("High OCR text quality (+15)");
    } else if (ocrQuality === "medium") {
      score += 10;
      reasons.push("Medium OCR text quality (+10)");
    } else {
      reasons.push("Low OCR text quality (0)");
      requiresManualSafety = true;
    }

    // 5. AI Validation (+15 / 0)
    if (!aiValidationFailed && (!medicine.requiresManualVerification || medicine.confidenceScore > 0.7)) {
      score += 15;
      reasons.push("AI Schema validation passed (+15)");
    } else {
      reasons.push("AI Schema validation issues detected (0)");
      requiresManualSafety = true;
    }

    // Determine Categories
    let level: VerificationLevel;
    let verificationRequired = false;

    if (requiresManualSafety || score < 60) {
      level = "Manual Verification Required";
      verificationRequired = true;
    } else if (score >= 85) {
      level = "High Confidence";
      verificationRequired = false;
    } else {
      level = "Review Recommended";
      verificationRequired = false; // "Review Recommended" is the preferred default but doesn't strictly force manual block
    }

    return {
      confidenceScore: Math.min(100, score),
      confidenceLevel: level,
      verificationRequired: verificationRequired,
      confidenceReasons: reasons
    };
  }
}

export const confidenceEngine = new ConfidenceEngine();
