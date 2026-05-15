const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const goldenDir = path.join(__dirname, "fixtures", "golden");

test("golden: Gemini medicines fixture maps to medications snapshot", () => {
  const { mapMedicinesToParseResult } = require("../dist/services/ocr/gemini-prescription-parse.js");
  const raw = fs.readFileSync(path.join(goldenDir, "gemini_medicines_fixture.json"), "utf8");
  const expected = JSON.parse(fs.readFileSync(path.join(goldenDir, "expected_medications_snapshot.json"), "utf8"));
  const parsed = JSON.parse(raw);
  const meds = mapMedicinesToParseResult(parsed.medicines);
  assert.deepEqual(JSON.parse(JSON.stringify(meds)), expected);
});

test("golden: extractJsonPayload strips markdown fences", () => {
  const { extractJsonPayload } = require("../dist/services/ocr/gemini-prescription-parse.js");
  const wrapped = "```json\n{\"medicines\":[],\"warnings\":[],\"ocr_quality\":\"low\"}\n```";
  const out = extractJsonPayload(wrapped);
  assert.deepEqual(out, { medicines: [], warnings: [], ocr_quality: "low" });
});

test("golden: min-1x1.png fixture exists for image pipeline smoke checks", () => {
  const pngPath = path.join(goldenDir, "min-1x1.png");
  assert.ok(fs.existsSync(pngPath), "min-1x1.png should exist (used for optional Vision smoke tests)");
  assert.ok(fs.statSync(pngPath).size > 0);
});
