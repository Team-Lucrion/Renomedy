const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BLOCKED_MEDICINE_MESSAGE,
  findMedicineCatalogCorrectionCandidates,
  findMedicineCatalogMatch,
  getMedicineSupportSafety,
  MANUAL_HIGH_RISK_MESSAGE
} = require("../dist/utils/medicineIntelligence.js");

test("catalog lookup ranks exact brand matches before priority fallback", () => {
  const match = findMedicineCatalogMatch({ medicine_name: "Telma 40" });
  assert.equal(match.brandName, "Telma 40 Tablet");
  assert.equal(match.supportMode, "full_support");
});

test("ordinary catalog lookup avoids broad OCR mistake false positives", () => {
  const match = findMedicineCatalogMatch({ medicine_name: "Teima" });
  assert.equal(match, null);
});

test("OCR correction candidates use catalog OCR mistake metadata", () => {
  const [candidate] = findMedicineCatalogCorrectionCandidates("Teima", 1);
  assert.equal(candidate.genericName, "Telmisartan");
});

test("support mode safety messages use required beta copy", () => {
  assert.equal(getMedicineSupportSafety({ supportMode: "manual_only_high_risk" }).message, MANUAL_HIGH_RISK_MESSAGE);
  assert.equal(getMedicineSupportSafety({ supportMode: "blocked" }).message, BLOCKED_MEDICINE_MESSAGE);
});
