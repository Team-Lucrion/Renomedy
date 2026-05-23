const test = require("node:test");
const assert = require("node:assert/strict");

function loadGroqParserWithEnv() {
  const previous = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL
  };

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  process.env.SUPABASE_STORAGE_BUCKET = "prescriptions";
  process.env.CLERK_SECRET_KEY = "clerk_secret";
  process.env.CLERK_WEBHOOK_SECRET = "clerk_webhook_secret";
  process.env.GROQ_API_KEY = "test-groq-key";
  process.env.GROQ_MODEL = "test-model";

  delete require.cache[require.resolve("../dist/config/env.js")];
  delete require.cache[require.resolve("../dist/services/ocr/groq-prescription-parse.js")];

  const mod = require("../dist/services/ocr/groq-prescription-parse.js");
  Object.assign(process.env, previous);
  return mod;
}

test("parseMedicinesWithGroq unwraps assistant message JSON from chat completion response", async () => {
  const originalFetch = global.fetch;
  const { parseMedicinesWithGroq, mapGroqMedicinesToParseResult } = loadGroqParserWithEnv();

  global.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.match(request.messages[1].content, /Medicine: Dolo/);

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-test",
          object: "chat.completion",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify({
                  medicines: [
                    {
                      name: "Dolo",
                      strength: "650mg",
                      dose: "1 tablet",
                      frequency: "BD",
                      frequencyMeaning: "twice daily",
                      timing: "morning and night",
                      foodTiming: "after food",
                      durationDays: 5,
                      instructions: "",
                      confidence: 0.9,
                      needsReview: false
                    }
                  ],
                  warnings: []
                })
              },
              finish_reason: "stop"
            }
          ]
        })
    };
  };

  try {
    const { parsed } = await parseMedicinesWithGroq(
      [
        "Medicine: Dolo",
        "Strength: 650mg",
        "Dose: 1 tablet",
        "Frequency: BD",
        "Timing: morning and night",
        "Food: after food",
        "Duration: 5 days"
      ].join("\n")
    );

    const medicines = mapGroqMedicinesToParseResult(parsed.medicines);
    assert.equal(medicines.length, 1);
    assert.equal(medicines[0].medicineName, "Dolo");
    assert.equal(medicines[0].strength, "650mg");
    assert.equal(medicines[0].dose, "1 tablet");
    assert.equal(medicines[0].frequency, "BD");
    assert.equal(medicines[0].timing, "morning and night");
    assert.equal(medicines[0].foodTiming, "after food");
    assert.equal(medicines[0].duration, "5 days");
    assert.equal(medicines[0].confidenceScore, 0.9);
    assert.equal(medicines[0].requiresManualVerification, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("mapGroqMedicinesToParseResult keeps timing separate from foodTiming", () => {
  const { mapGroqMedicinesToParseResult } = loadGroqParserWithEnv();
  const medicines = mapGroqMedicinesToParseResult([
    {
      name: "Pan",
      strength: "40mg",
      dose: "1 tablet",
      frequency: "OD",
      frequencyMeaning: "once daily",
      timing: "morning",
      foodTiming: "before food",
      durationDays: 10,
      confidence: 0.88,
      needsReview: false
    }
  ]);

  assert.equal(medicines.length, 1);
  assert.equal(medicines[0].timing, "morning");
  assert.equal(medicines[0].foodTiming, "before food");
  assert.match(medicines[0].shorthandExplanation, /once daily/);
  assert.match(medicines[0].shorthandExplanation, /morning/);
  assert.match(medicines[0].shorthandExplanation, /before food/);
});

test("extractJsonPayload still accepts direct prescription JSON", () => {
  const { extractJsonPayload } = loadGroqParserWithEnv();
  const parsed = extractJsonPayload('{"medicines":[{"name":"Pan","confidence":0.8}],"warnings":[]}');

  assert.equal(parsed.medicines.length, 1);
  assert.equal(parsed.medicines[0].name, "Pan");
  assert.deepEqual(parsed.warnings, []);
});
