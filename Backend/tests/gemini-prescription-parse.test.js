const test = require("node:test");
const assert = require("node:assert/strict");

test("assessOcrQuality tests", async (t) => {
  const { assessOcrQuality } = require("../dist/services/ocr/gemini-prescription-parse.js");

  await t.test("returns low for very short text", () => {
    assert.equal(assessOcrQuality("short"), "low");
    assert.equal(assessOcrQuality("12345678901234"), "low");
  });

  await t.test("returns low for text with score < 60", () => {
    // 50 chars, no medicine signals => score 50
    const text = "a".repeat(50);
    assert.equal(assessOcrQuality(text), "low");
  });

  await t.test("returns medium for text with score >= 60 and < 180", () => {
    // 60 chars, no medicine signals => score 60
    const text60 = "a".repeat(60);
    assert.equal(assessOcrQuality(text60), "medium");

    // 179 chars, no medicine signals => score 179
    const text179 = "a".repeat(179);
    assert.equal(assessOcrQuality(text179), "medium");
  });

  await t.test("returns high for text with score >= 180", () => {
    // 180 chars, no medicine signals => score 180
    const text180 = "a".repeat(180);
    assert.equal(assessOcrQuality(text180), "high");
  });

  await t.test("boosts score with medicine signals", () => {
    // Medicine signals: tab, tablet, cap, capsule, mg, mcg, ml, syrup, od, bd, tds, hs, sos, ac, pc
    // Length: 20 chars
    // Signals: tab, mg, od => 3 signals
    // Score = 20 + (3 * 12) = 20 + 36 = 56 (low)
    // Add one more signal to reach 60: 'bd'
    // Score = 24 + (4 * 12) = 24 + 48 = 72 (medium)
    const textMedium = "tab paracetamol 500 mg od bd"; // Length: 28, Alnum: 24, Signals: tab, mg, od, bd (4) => 24 + 48 = 72
    assert.equal(assessOcrQuality(textMedium), "medium");

    // To get high, we need score >= 180.
    // 15 signals = 180 points.
    const textHigh = "tab tablet cap capsule mg mcg ml syrup od bd tds hs sos ac pc";
    // Alnum count is around 50.
    // Signals: 15
    // Score = ~50 + 15 * 12 = 50 + 180 = 230
    assert.equal(assessOcrQuality(textHigh), "high");
  });

  await t.test("handles mixed case medicine signals", () => {
    const textMedium = "TAB paracetamol 500 MG OD bd";
    // Signals: TAB, MG, OD, bd (4)
    // Alnum: 24
    // Score: 24 + 48 = 72
    assert.equal(assessOcrQuality(textMedium), "medium");
  });

  await t.test("ignores non-alphanumeric in score calculation but keeps them for length if not space", () => {
    // Length >= 15
    // Alnum count: 10
    // Signals: 0
    // Score = 10
    assert.equal(assessOcrQuality("abcde12345!@#$%^&*()"), "low");
  });
});
