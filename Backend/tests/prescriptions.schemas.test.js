const test = require("node:test");
const assert = require("node:assert/strict");

const {
  scanPrescriptionBodySchema,
  uploadPrescriptionBodySchema
} = require("../dist/modules/prescriptions/prescriptions.schemas.js");

test("scanPrescriptionBodySchema preserves extractedText", () => {
  const result = scanPrescriptionBodySchema.safeParse({
    family_member_id: "123e4567-e89b-12d3-a456-426614174000",
    extractedText: "Mock OCR Output",
    randomGarbage: "should be stripped"
  });

  assert.equal(result.success, true);
  assert.equal(result.data.extractedText, "Mock OCR Output");
  assert.equal(result.data.randomGarbage, undefined);
});

test("uploadPrescriptionBodySchema preserves extractedText", () => {
  const result = uploadPrescriptionBodySchema.safeParse({
    family_member_id: "123e4567-e89b-12d3-a456-426614174000",
    extractedText: "Mock OCR Output 2",
    doctor_name: "Dr. Smith"
  });

  assert.equal(result.success, true);
  assert.equal(result.data.extractedText, "Mock OCR Output 2");
  assert.equal(result.data.doctor_name, "Dr. Smith");
});
