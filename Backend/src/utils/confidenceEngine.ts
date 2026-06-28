import { OcrParsedMedication } from "../services/ocr/ocr-provider";
import { findMedicineCatalogMatch } from "./medicineIntelligence";

export type VerificationLevel = "High Confidence" | "Review Recommended" | "Manual Verification Required";

export type RiskFlag =
  | "MISSING_DOSAGE"
  | "UNKNOWN_MEDICINE"
  | "AMBIGUOUS_TIMING"
  | "LOW_OCR_QUALITY"
  | "FAILED_VALIDATION"
  | "INCOMPLETE_PRESCRIPTION"
  | "DUPLICATE_MEDICATION_DETECTED"
  | "SUSPICIOUS_MEDICATION_PATTERN";

export interface ConfidenceResult {
  confidenceScore: number;
  confidenceLevel: VerificationLevel;
  verificationRequired: boolean;
  confidenceReasons: string[];
  riskFlags: RiskFlag[];
}

export interface ConfidenceInputMetadata {
  ocrQuality?: "high" | "medium" | "low";
  aiValidationFailed?: boolean;
}

export class ConfidenceEngine {
  /**
   * Evaluates the entire prescription to compute confidence scores and identify cross-medication patterns.
   */
  public evaluatePrescription(
    medications: OcrParsedMedication[],
    metadata: ConfidenceInputMetadata = {}
  ): OcrParsedMedication[] {

    // Step 1: Pre-process and normalize medicines for context-aware duplicate/suspicious pattern rules
    const medicineOccurrences = new Map<string, OcrParsedMedication[]>();
    medications.forEach(med => {
      const normName = (med.medicineName || "").trim().toLowerCase();
      if (normName) {
        if (!medicineOccurrences.has(normName)) {
          medicineOccurrences.set(normName, []);
        }
        medicineOccurrences.get(normName)!.push(med);
      }
    });

    // Step 2: Evaluate each medication with context
    return medications.map(med => {
      const result = this.evaluateSingleMedication(med, metadata, medicineOccurrences);
      return {
        ...med,
        confidenceScore: result.confidenceScore,
        confidenceLevel: result.confidenceLevel,
        requiresManualVerification: result.verificationRequired,
        confidenceReasons: result.confidenceReasons,
        riskFlags: result.riskFlags
      };
    });
  }

  private evaluateSingleMedication(
    medicine: OcrParsedMedication,
    metadata: ConfidenceInputMetadata,
    contextOccurrences: Map<string, OcrParsedMedication[]>
  ): ConfidenceResult {
    const { ocrQuality = "medium", aiValidationFailed = false } = metadata;
    let score = 0;
    const reasons: string[] = [];
    const riskFlags: RiskFlag[] = [];

    // --- Modular Trust Signals ---

    // 1. Medicine Match (+30 / 0)
    let medicineVerified = false;
    if (medicine.medicineName) {
      const match = findMedicineCatalogMatch({ medicineName: medicine.medicineName });
      if (match) {
        score += 30;
        reasons.push(`Medicine perfectly matched in catalog: ${match.brandName} (+30)`);
        medicineVerified = true;
      } else {
        reasons.push("Medicine not found in catalog (0)");
        riskFlags.push("UNKNOWN_MEDICINE");
      }
    } else {
      reasons.push("Missing medicine name (0)");
      riskFlags.push("UNKNOWN_MEDICINE");
    }

    // 2. Dosage (+25 / 0)
    const hasDosage = (medicine.dosage && medicine.dosage.trim().length > 0) ||
                      (medicine.strength && medicine.strength.trim().length > 0);
    if (hasDosage) {
      score += 25;
      reasons.push("Dosage extracted (+25)");
    } else {
      reasons.push("Missing dosage/strength (0)");
      riskFlags.push("MISSING_DOSAGE");
    }

    // 3. Timing / Frequency (+15 / 0)
    const hasTiming = (medicine.frequency && medicine.frequency.trim().length > 0) ||
                      (medicine.timing && medicine.timing.trim().length > 0);
    if (hasTiming) {
      score += 15;
      reasons.push("Timing/Frequency extracted (+15)");
    } else {
      reasons.push("Missing timing/frequency (0)");
      riskFlags.push("AMBIGUOUS_TIMING");
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
      riskFlags.push("LOW_OCR_QUALITY");
    }

    // 5. AI Validation (+15 / 0)
    if (!aiValidationFailed && (!medicine.requiresManualVerification || medicine.confidenceScore > 0.7)) {
      score += 15;
      reasons.push("AI Schema validation passed (+15)");
    } else {
      reasons.push("AI Schema validation issues detected (0)");
      riskFlags.push("FAILED_VALIDATION");
    }

    // --- Context-Aware Rules (Suspicious Medication Patterns & Duplicates) ---
    const normName = (medicine.medicineName || "").trim().toLowerCase();
    const siblings = contextOccurrences.get(normName) || [];

    // Rule D: Medicine appears repeatedly (3+ times)
    if (siblings.length >= 3) {
      riskFlags.push("DUPLICATE_MEDICATION_DETECTED");
      riskFlags.push("SUSPICIOUS_MEDICATION_PATTERN");
      reasons.push("Medicine appears 3 or more times (Suspicious Pattern)");
    }

    // Rules for when there are 2 or more occurrences
    if (siblings.length > 1) {
      // Check Rule A: Conflicting strengths
      const strengths = new Set(siblings.map(s => s.strength || s.dosage || "").filter(Boolean));
      if (strengths.size > 1) {
        riskFlags.push("SUSPICIOUS_MEDICATION_PATTERN");
        reasons.push("Conflicting strengths for the same medicine (Suspicious Pattern)");
      }

      // Check Rule B: Contradictory frequency instructions
      const frequencies = new Set(siblings.map(s => s.frequency || "").filter(Boolean));
      if (frequencies.size > 1) {
        riskFlags.push("SUSPICIOUS_MEDICATION_PATTERN");
        reasons.push("Conflicting frequency instructions for the same medicine (Suspicious Pattern)");
      }
    }

    // Rule C: Medicine exists but both dosage and timing are missing
    if (medicineVerified && !hasDosage && !hasTiming) {
      riskFlags.push("SUSPICIOUS_MEDICATION_PATTERN");
      reasons.push("Valid medicine but both dosage and timing are missing (Suspicious Pattern)");
    }

    // --- Critical Override Logic ---
    let level: VerificationLevel;
    let verificationRequired = false;

    // Remove duplicates from riskFlags
    const uniqueRiskFlags = Array.from(new Set(riskFlags));

    const finalScore = Math.min(100, score);

    // Check if any flag is a critical safety flag that MUST trigger manual review
    // For this engine, we consider the following as critical safety overrides:
    const criticalFlags: RiskFlag[] = [
      "MISSING_DOSAGE",
      "FAILED_VALIDATION",
      "SUSPICIOUS_MEDICATION_PATTERN",
      "DUPLICATE_MEDICATION_DETECTED",
      "LOW_OCR_QUALITY",
      "INCOMPLETE_PRESCRIPTION" // Placeholders for future use
    ];

    const hasCriticalFlag = uniqueRiskFlags.some(flag => criticalFlags.includes(flag));

    if (finalScore < 60 || hasCriticalFlag) {
      level = "Manual Verification Required";
      verificationRequired = true;
    } else if (finalScore >= 85) {
      level = "High Confidence";
      verificationRequired = false;
    } else {
      level = "Review Recommended";
      verificationRequired = false;
    }

    return {
      confidenceScore: finalScore,
      confidenceLevel: level,
      verificationRequired,
      confidenceReasons: reasons,
      riskFlags: uniqueRiskFlags
    };
  }
}

export const confidenceEngine = new ConfidenceEngine();
