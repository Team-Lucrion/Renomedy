import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";

// We have to mock `fetch` before importing the service to intercept the HTTP calls
const originalFetch = global.fetch;

describe("MedGemmaService", () => {
  let MedGemmaService;

  beforeEach(async () => {
    mock.restoreAll();

    // Mock environment variables so env parsing doesn't throw during tests
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.CLERK_SECRET_KEY = "clerk-secret-key";
    process.env.CLERK_WEBHOOK_SECRET = "clerk-webhook-secret";

    // We dynamically import to ensure our mocks are in place if needed,
    // though for fetch we just replace global.fetch directly
    const module = await import("../dist/services/ai/medgemma/medgemma.service.js");
    MedGemmaService = module.MedGemmaService;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should successfully parse a valid inference response", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              medicines: [
                {
                  medicine_name: "Amoxicillin",
                  dosage: "500mg",
                  frequency: "Twice daily",
                  duration: "5 days",
                  confidence: "high"
                }
              ],
              warnings: [],
              ocr_quality: "medium"
            })
          }
        }
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50
      }
    };

    global.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => mockResponse,
    }));

    const service = new MedGemmaService();
    const result = await service.extractMedicines("Amoxicillin 500mg twice daily for 5 days");

    assert.strictEqual(result.payload.medicines.length, 1);
    assert.strictEqual(result.payload.medicines[0].medicine_name, "Amoxicillin");
    assert.strictEqual(result.payload.medicines[0].confidence, "high");
    assert.strictEqual(result.payload.ocr_quality, "medium");
    assert.strictEqual(global.fetch.mock.calls.length, 1);
  });

  it("should handle malformed JSON by attempting recovery or returning fallback", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            // Unparseable garbage
            content: "I am an AI, here is some text. ```json { broken: true ```"
          }
        }
      ]
    };

    global.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => mockResponse,
    }));

    const service = new MedGemmaService();
    // Since it's completely malformed, the validation catch block throws an error.
    // The service retry logic catches it, retries up to config limit, and then throws.
    await assert.rejects(
      async () => await service.extractMedicines("Bad text"),
      /MedGemma inference failed: MedGemma returned malformed JSON/
    );
  });

  it("should handle a valid JSON but invalid schema by applying the default fallback object", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            // Valid JSON but doesn't match MedGemmaPrescriptionPayload schema perfectly
            // Zod's safeParse will fail, and our parser will return an empty array of medicines
            content: JSON.stringify({ random_key: "random_value", unexpected_medicines: "not_an_array" })
          }
        }
      ]
    };

    global.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => mockResponse,
    }));

    const service = new MedGemmaService();
    const result = await service.extractMedicines("Valid but incorrect schema");

    // It should fall back to an empty structure rather than crashing completely on schema mismatch
    assert.deepStrictEqual(result.payload.medicines, []);
    assert.strictEqual(result.payload.ocr_quality, "low");
  });

  it("should retry on network failure/timeout and eventually throw if max retries reached", async () => {
    global.fetch = mock.fn(async () => {
      throw new Error("Network timeout");
    });

    const service = new MedGemmaService();
    // Override retryCount and delay to speed up tests (we just access private vars via bracket notation for testing)
    service.retryCount = 2;
    service.timeoutMs = 1000;

    const start = Date.now();
    await assert.rejects(
      async () => await service.extractMedicines("Timeout test"),
      /MedGemma inference failed: Network timeout/
    );

    // Fetch should be called 1 initial time + 2 retries = 3 times
    assert.strictEqual(global.fetch.mock.calls.length, 3);
  });

  it("should retry on non-200 HTTP response and eventually succeed", async () => {
    let callCount = 0;
    const mockSuccessResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({ medicines: [], warnings: [], ocr_quality: "low" })
          }
        }
      ]
    };

    global.fetch = mock.fn(async () => {
      callCount++;
      if (callCount < 2) {
        return {
          ok: false,
          status: 503,
          text: async () => "Service Unavailable"
        };
      }
      return {
        ok: true,
        json: async () => mockSuccessResponse
      };
    });

    const service = new MedGemmaService();
    service.retryCount = 3;

    const result = await service.extractMedicines("Retry recovery test");
    assert.deepStrictEqual(result.payload.medicines, []);
    assert.strictEqual(global.fetch.mock.calls.length, 2); // 1 failure + 1 success
  });
});
