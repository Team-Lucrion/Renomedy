const test = require("node:test");
const assert = require("node:assert/strict");

const { parseMedGemmaResponse } = require("../dist/services/ai/medgemma/medgemma.validation.js");

test("parseMedGemmaResponse recovers partially malformed arrays", () => {
  const mockPayload = {
    medicines: [
      { medicine_name: "Valid Medicine", dosage: "10mg", frequency: "OD", duration: "5 days" },
      { unexpected_key: "garbage data" }
    ],
    ocr_quality: "high"
  };

  const parsed = parseMedGemmaResponse(JSON.stringify(mockPayload));

  assert.equal(parsed.medicines.length, 2);
  assert.equal(parsed.medicines[0].medicine_name, "Valid Medicine");
  assert.equal(parsed.medicines[1].medicine_name, "");
});

test("parseMedGemmaResponse handles completely invalid JSON via regex extraction", () => {
  const rawResponse = `
    Here is the data you requested:
    \`\`\`json
    {
      "medicines": [
        { "medicine_name": "Recovered Medicine", "dosage": "5mg", "confidence": "high" }
      ],
      "ocr_quality": "medium"
    }
    \`\`\`
    Hope this helps!
  `;

  const parsed = parseMedGemmaResponse(rawResponse);

  assert.equal(parsed.medicines.length, 1);
  assert.equal(parsed.medicines[0].medicine_name, "Recovered Medicine");
  assert.equal(parsed.ocr_quality, "medium");
});

test("parseMedGemmaResponse throws on completely malformed unrecoverable text", () => {
  const garbage = "This is just text without any JSON structure.";

  assert.throws(
    () => parseMedGemmaResponse(garbage),
    /MedGemma returned malformed JSON/
  );
});
