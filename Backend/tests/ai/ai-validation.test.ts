import { test } from "node:test";
import assert from "node:assert";
import { validateReasoningResponse, cleanJsonResponse } from "../../src/services/ai/validation";

test("cleanJsonResponse strips markdown code fences", () => {
  const raw = "```json\n{\"test\": 1}\n```";
  const cleaned = cleanJsonResponse(raw);
  assert.strictEqual(cleaned, "{\"test\": 1}");
});

test("validateReasoningResponse salvages medicines from partial schema failure", () => {
  const invalidPayload = {
    medicines: [
      { name: "Metformin", invalid_field: true },
      { no_name: "broken" }
    ],
    warnings: "not an array"
  };

  const result = validateReasoningResponse(invalidPayload);
  assert.strictEqual(result.medicines.length, 1);
  assert.strictEqual(result.medicines[0].name, "Metformin");
  assert.deepStrictEqual(result.warnings, ["Validation recovery mode active"]);
});

test("validateReasoningResponse returns empty defaults on total failure", () => {
  const result = validateReasoningResponse(null);
  assert.strictEqual(result.medicines.length, 0);
  assert.deepStrictEqual(result.warnings, ["Critical validation failure"]);
});
