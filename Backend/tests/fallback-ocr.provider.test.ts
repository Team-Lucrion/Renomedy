import { test } from "node:test";
import assert from "node:assert";
import { FallbackOcrProvider } from "../src/services/ocr/fallback-ocr.provider";
import type { OcrParseResult, OcrProvider } from "../src/services/ocr/ocr-provider";

// A simple mock provider where we can inject the result or an error to throw
class MockInjectableOcrProvider implements OcrProvider {
  public resultToReturn: OcrParseResult | Error;

  constructor(resultToReturn: OcrParseResult | Error) {
    this.resultToReturn = resultToReturn;
  }

  async parsePrescription(
    _imageBuffer: Buffer,
    _options?: { extractedText?: string; ocrMetadata?: Record<string, unknown> }
  ): Promise<OcrParseResult> {
    if (this.resultToReturn instanceof Error) {
      throw this.resultToReturn;
    }
    return this.resultToReturn;
  }
}

function createMockResult(status: "parsed" | "failed", medicineCount: number = 1): OcrParseResult {
  const medications = Array(medicineCount).fill({
    medicineName: "Test Med",
    requiresManualVerification: false,
    confidenceScore: 0.9,
    shorthandDetected: []
  });

  return {
    rawText: "Mock text",
    parseStatus: status,
    medications,
    providerMetadata: { mock_meta: "data" }
  };
}

test("FallbackOcrProvider returns primary result if primary succeeds without fallback", async () => {
  const primaryResult = createMockResult("parsed", 1);
  const primary = new MockInjectableOcrProvider(primaryResult);
  const fallback = new MockInjectableOcrProvider(createMockResult("parsed", 1));

  const provider = new FallbackOcrProvider(primary, fallback, "primary", "fallback");
  const result = await provider.parsePrescription(Buffer.from(""));

  assert.strictEqual(result, primaryResult);
  assert.strictEqual(result.providerMetadata?.fallback_from, undefined);
});

test("FallbackOcrProvider catches error from primary and returns fallback result", async () => {
  const primaryError = new Error("Primary completely failed");
  const fallbackResult = createMockResult("parsed", 2);

  const primary = new MockInjectableOcrProvider(primaryError);
  const fallback = new MockInjectableOcrProvider(fallbackResult);

  const provider = new FallbackOcrProvider(primary, fallback, "primary", "fallback");
  const result = await provider.parsePrescription(Buffer.from(""));

  assert.strictEqual(result.medications.length, 2);
  assert.strictEqual(result.providerMetadata?.fallback_from, "primary");
  assert.strictEqual(result.providerMetadata?.fallback_provider, "fallback");

  const primaryFailure = result.providerMetadata?.primary_failure as any;
  assert.strictEqual(primaryFailure.error, "Primary completely failed");
});

test("FallbackOcrProvider uses fallback if primary returns empty medications (shouldFallback is true)", async () => {
  const primaryResult = createMockResult("parsed", 0); // 0 meds -> shouldFallback
  const fallbackResult = createMockResult("parsed", 1);

  const primary = new MockInjectableOcrProvider(primaryResult);
  const fallback = new MockInjectableOcrProvider(fallbackResult);

  const provider = new FallbackOcrProvider(primary, fallback, "primary", "fallback");
  const result = await provider.parsePrescription(Buffer.from(""));

  assert.strictEqual(result.medications.length, 1);
  assert.strictEqual(result.providerMetadata?.fallback_from, "primary");

  const primaryFailure = result.providerMetadata?.primary_failure as any;
  assert.strictEqual(primaryFailure.parseStatus, "parsed");
  assert.strictEqual(primaryFailure.medicationsDetected, 0);
});

test("FallbackOcrProvider returns primary result with fallback failure info if both primary and fallback fail", async () => {
  const primaryResult = createMockResult("parsed", 0); // fails validation
  const fallbackResult = createMockResult("failed", 0); // fails validation

  const primary = new MockInjectableOcrProvider(primaryResult);
  const fallback = new MockInjectableOcrProvider(fallbackResult);

  const provider = new FallbackOcrProvider(primary, fallback, "primary", "fallback");
  const result = await provider.parsePrescription(Buffer.from(""));

  // Because both failed, it falls back to returning the primary result, but annotates it
  assert.strictEqual(result.medications.length, 0);
  assert.strictEqual(result.providerMetadata?.fallback_attempted, "fallback");

  const fallbackFailure = result.providerMetadata?.fallback_failure as any;
  assert.strictEqual(fallbackFailure.parseStatus, "failed");
  assert.strictEqual(fallbackFailure.medicationsDetected, 0);
});
