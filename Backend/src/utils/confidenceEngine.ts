import { findMedicineCatalogMatch, findMedicineCatalogCorrectionCandidates } from './medicineIntelligence';
import { evaluateMedicineRelationships, normalizeMedicineText } from './medicineTrust';

export interface ConfidenceThresholds {
  autoAccept: number;
  review: number;
}

export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  autoAccept: 0.95,
  review: 0.90,
};

export interface MedicationSignal {
  medicineName: string;
  genericName?: string;
  strength?: string;
  dosage?: string;
  frequency?: string;
  ocrConfidence?: number;
  medGemmaConfidence?: number;
}

export type ConfidenceLevel = "Auto Accept" | "Review" | "Manual Verification";

export interface ConfidenceResult {
  confidenceScore: number;
  level: ConfidenceLevel;
  validationFailures: string[];
  isUnknown: boolean;
  matchType: "exact" | "alias" | "correction" | "fuzzy" | "none";
}

export function computeConfidence(
  signal: MedicationSignal,
  existingMedicines: Array<{ medicine_name?: string; generic_name?: string; strength?: string; dosage?: string }> = [],
  thresholds: ConfidenceThresholds = DEFAULT_THRESHOLDS
): ConfidenceResult {
  let score = 0;
  const validationFailures: string[] = [];
  let isUnknown = false;
  let matchType: "exact" | "alias" | "correction" | "fuzzy" | "none" = "none";

  const ocrScore = typeof signal.ocrConfidence === "number" ? Math.max(0, Math.min(1, signal.ocrConfidence)) : 0.5;
  const aiScore = typeof signal.medGemmaConfidence === "number" ? Math.max(0, Math.min(1, signal.medGemmaConfidence)) : 0.5;
  let baseScore = (ocrScore * 0.4) + (aiScore * 0.6); // Weight towards AI

  // Exact Match Check
  const exactMatch = findMedicineCatalogMatch({
    medicine_name: signal.medicineName,
    generic_name: signal.genericName
  });

  if (exactMatch) {
    matchType = "exact";
    baseScore = Math.min(1.0, baseScore + 0.3); // Exact match gives high confidence boost
  } else {
    // Correction Candidates
    const corrections = findMedicineCatalogCorrectionCandidates(signal.medicineName, 1);
    if (corrections.length > 0) {
      matchType = "correction";
      baseScore = Math.min(1.0, baseScore + 0.1);
    } else {
      isUnknown = true;
      validationFailures.push("Unknown medicine");
      baseScore = baseScore * 0.5; // Heavy penalty
    }
  }

  // Missing dosage
  if (!signal.dosage && !signal.strength) {
    validationFailures.push("Missing dosage");
    baseScore *= 0.8;
  }

  // Invalid strength
  if ((signal.strength || signal.dosage) && exactMatch) {
    const rawStrength = normalizeMedicineText(signal.strength || signal.dosage);
    const catalogStrength = normalizeMedicineText(exactMatch.strength);
    if (catalogStrength && rawStrength && !rawStrength.includes(catalogStrength) && !catalogStrength.includes(rawStrength)) {
      validationFailures.push("Invalid strength");
      baseScore *= 0.8;
    }
  }

  // Impossible frequency (simple check)
  if (signal.frequency) {
    const text = signal.frequency.toLowerCase();
    // extremely simple check for impossible frequency, e.g. 10+ times a day
    if (/(?:1[0-9]|2[0-4])\s*(?:times|x)\s*a\s*day/.test(text) || /\b(?:1[0-9]|2[0-9])\b.*?(?:daily|day)/.test(text)) {
      validationFailures.push("Impossible frequency");
      baseScore *= 0.6;
    }
  }

  // Ambiguous OCR
  if (ocrScore < 0.3) {
    validationFailures.push("Ambiguous OCR");
    baseScore *= 0.8;
  }

  // Duplicate medicines
  if (existingMedicines && existingMedicines.length > 0) {
     const candidate = {
       medicine_name: signal.medicineName,
       generic_name: signal.genericName,
       strength: signal.strength,
       dosage: signal.dosage
     };
     const notices = evaluateMedicineRelationships(candidate, existingMedicines);

     if (notices.some((n: any) => n.type === "duplicate_state")) {
       validationFailures.push("Duplicate medicine");
       baseScore *= 0.7; // Needs review due to duplication
     }
  }

  score = Number(baseScore.toFixed(3));

  let level: ConfidenceLevel = "Manual Verification";
  if (score >= thresholds.autoAccept) level = "Auto Accept";
  else if (score >= thresholds.review) level = "Review";

  return {
    confidenceScore: score,
    level,
    validationFailures,
    isUnknown,
    matchType
  };
}
