import { test } from "node:test";
import assert from "node:assert";
import { MedGemmaProvider } from "../../src/services/ai/medgemma-provider";

test("MedGemmaProvider.reason handles successful structured response", async (t) => {
  const mockResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            medicines: [
              {
                name: "Metformin",
                strength: "500mg",
                frequency: "BD",
                confidence: 0.9,
                needsReview: false
              }
            ],
            warnings: []
          })
        }
      }
    ]
  };

  const config = {
    endpoint: "http://mock-medgemma",
    model: "medgemma-1.5-4b",
    timeoutMs: 1000,
    retryCount: 0,
    maxTokens: 100,
    temperature: 0.1
  };

  // Mock global fetch
  const originalFetch = global.fetch;
  (global as any).fetch = async () => ({
    ok: true,
    json: async () => mockResponse
  });

  const provider = new MedGemmaProvider(config);
  const result = await provider.reason("Metformin 500mg BD");

  assert.strictEqual(result.medications.length, 1);
  assert.strictEqual(result.medications[0].medicineName, "Metformin");
  assert.strictEqual(result.provider, "medgemma");

  global.fetch = originalFetch;
});

test("MedGemmaProvider.reason handles malformed JSON with recovery", async (t) => {
  const mockResponse = {
    choices: [
      {
        message: {
          content: "Some prose before JSON {\"medicines\": [{\"name\": \"Amlodipine\"}], \"warnings\": []} and after."
        }
      }
    ]
  };

  const config = {
    endpoint: "http://mock-medgemma",
    model: "medgemma-1.5-4b",
    timeoutMs: 1000,
    retryCount: 0,
    maxTokens: 100,
    temperature: 0.1
  };

  const originalFetch = global.fetch;
  (global as any).fetch = async () => ({
    ok: true,
    json: async () => mockResponse
  });

  const provider = new MedGemmaProvider(config);
  const result = await provider.reason("Amlodipine");

  assert.strictEqual(result.medications.length, 1);
  assert.strictEqual(result.medications[0].medicineName, "Amlodipine");

  global.fetch = originalFetch;
});

test("MedGemmaProvider.reason retries on failure", async (t) => {
  let attempts = 0;
  const config = {
    endpoint: "http://mock-medgemma",
    model: "medgemma-1.5-4b",
    timeoutMs: 100,
    retryCount: 1,
    maxTokens: 100,
    temperature: 0.1
  };

  const originalFetch = global.fetch;
  (global as any).fetch = async () => {
    attempts++;
    if (attempts === 1) throw new Error("Network failure");
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "{\"medicines\": []}" } }]
      })
    };
  };

  const provider = new MedGemmaProvider(config);
  const result = await provider.reason("test");

  assert.strictEqual(attempts, 2);
  assert.strictEqual(result.retryCount, 1);

  global.fetch = originalFetch;
});
