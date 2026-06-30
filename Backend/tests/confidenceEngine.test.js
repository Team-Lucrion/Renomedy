const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { ConfidenceEngine } = require("../dist/utils/confidenceEngine.js");

// Replace underlying medicineSafety/medicineIntelligence for testing isolated ConfidenceEngine behavior
const medicineIntelligence = require("../dist/utils/medicineIntelligence.js");
const medicineSafety = require("../dist/utils/medicineSafety.js");

test("ConfidenceEngine - High Confidence baseline", () => {
  const originalMatch = medicineIntelligence.findMedicineCatalogMatch;
  medicineIntelligence.findMedicineCatalogMatch = () => ({ brandName: "Dolo 650" });

  const engine = new ConfidenceEngine();
  const result = engine.evaluatePrescription([
    {
      medicineName: "Dolo 650",
      dosage: "1 tablet",
      timing: "after food",
      duration: "5 days"
    }
  ], { ocrQuality: "high", aiValidationFailed: false });

  assert.equal(result.length, 1);
  const med = result[0];

  assert.equal(med.confidenceLevel, "High Confidence");
  assert.equal(med.requiresManualVerification, false);
  assert.ok(med.confidenceScore >= 85);

  medicineIntelligence.findMedicineCatalogMatch = originalMatch;
});

test("ConfidenceEngine - MISSING_DOSAGE triggers Manual Verification Required", () => {
  const engine = new ConfidenceEngine();
  const result = engine.evaluatePrescription([
    {
      medicineName: "Dolo 650",
      dosage: "", // Missing
      strength: "", // Missing
      timing: "after food",
      duration: "5 days"
    }
  ]);

  const med = result[0];
  assert.ok(med.riskFlags.includes("MISSING_DOSAGE"));
  assert.equal(med.confidenceLevel, "Manual Verification Required");
  assert.equal(med.requiresManualVerification, true);
});

test("ConfidenceEngine - CRITICAL_MONITORED_MEDICINE triggers Manual Verification Required", () => {
  const originalMatch = medicineIntelligence.findMedicineCatalogMatch;
  medicineIntelligence.findMedicineCatalogMatch = () => ({ brandName: "Methotrexate" });

  const originalCritical = medicineSafety.isCriticalMonitoredMedicine;
  medicineSafety.isCriticalMonitoredMedicine = () => true;

  const engine = new ConfidenceEngine();
  const result = engine.evaluatePrescription([
    {
      medicineName: "Methotrexate",
      dosage: "1 tablet",
      timing: "once a week",
      duration: "1 month"
    }
  ], { ocrQuality: "high", aiValidationFailed: false });

  const med = result[0];
  assert.ok(med.riskFlags.includes("CRITICAL_MONITORED_MEDICINE"));
  assert.equal(med.confidenceLevel, "Manual Verification Required");
  assert.equal(med.requiresManualVerification, true);

  medicineIntelligence.findMedicineCatalogMatch = originalMatch;
  medicineSafety.isCriticalMonitoredMedicine = originalCritical;
});

test("ConfidenceEngine - SUSPICIOUS_MEDICATION_PATTERN triggers for conflicting strengths", () => {
  const engine = new ConfidenceEngine();
  const result = engine.evaluatePrescription([
    {
      medicineName: "Amoxicillin",
      dosage: "500mg",
      timing: "twice daily",
      duration: "5 days"
    },
    {
      medicineName: "Amoxicillin",
      dosage: "250mg", // Conflict
      timing: "twice daily",
      duration: "5 days"
    }
  ]);

  assert.ok(result[0].riskFlags.includes("SUSPICIOUS_MEDICATION_PATTERN"));
  assert.equal(result[0].confidenceLevel, "Manual Verification Required");

  assert.ok(result[1].riskFlags.includes("SUSPICIOUS_MEDICATION_PATTERN"));
  assert.equal(result[1].confidenceLevel, "Manual Verification Required");
});

test("ConfidenceEngine - LOW_OCR_QUALITY triggers Manual Verification Required", () => {
  const engine = new ConfidenceEngine();
  const result = engine.evaluatePrescription([
    {
      medicineName: "Dolo 650",
      dosage: "1 tablet",
      timing: "after food",
      duration: "5 days"
    }
  ], { ocrQuality: "low" });

  const med = result[0];
  assert.ok(med.riskFlags.includes("LOW_OCR_QUALITY"));
  assert.equal(med.confidenceLevel, "Manual Verification Required");
  assert.equal(med.requiresManualVerification, true);
});

test("ConfidenceEngine - FAILED_VALIDATION triggers Manual Verification Required", () => {
  const engine = new ConfidenceEngine();
  const result = engine.evaluatePrescription([
    {
      medicineName: "Dolo 650",
      dosage: "1 tablet",
      timing: "after food",
      duration: "5 days"
    }
  ], { aiValidationFailed: true });

  const med = result[0];
  assert.ok(med.riskFlags.includes("FAILED_VALIDATION"));
  assert.equal(med.confidenceLevel, "Manual Verification Required");
  assert.equal(med.requiresManualVerification, true);
});

test("ConfidenceEngine - MISSING_CRITICAL_DURATION triggers Manual Verification Required", () => {
  const originalDuration = medicineSafety.isHighRiskDurationMedicine;
  medicineSafety.isHighRiskDurationMedicine = () => true;

  const engine = new ConfidenceEngine();
  const result = engine.evaluatePrescription([
    {
      medicineName: "Amoxicillin",
      dosage: "1 tablet",
      timing: "after food",
      duration: ""
    }
  ]);

  const med = result[0];
  assert.ok(med.riskFlags.includes("MISSING_CRITICAL_DURATION"));
  assert.equal(med.confidenceLevel, "Manual Verification Required");
  assert.equal(med.requiresManualVerification, true);

  medicineSafety.isHighRiskDurationMedicine = originalDuration;
});
