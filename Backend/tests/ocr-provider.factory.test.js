const test = require("node:test");
const assert = require("node:assert/strict");

function loadFactoryWithEnv(overrides) {
  const previous = {
    OCR_PROVIDER: process.env.OCR_PROVIDER,
    OCR_API_URL: process.env.OCR_API_URL,
    OCR_API_KEY: process.env.OCR_API_KEY,
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

  delete process.env.OCR_API_URL;
  delete process.env.OCR_API_KEY;

  Object.assign(process.env, overrides);

  delete require.cache[require.resolve("../dist/config/env.js")];
  delete require.cache[require.resolve("../dist/services/ocr/ocr-provider.factory.js")];
  delete require.cache[require.resolve("../dist/services/ocr/mock-ocr.provider.js")];
  delete require.cache[require.resolve("../dist/services/ocr/vision-gemini-ocr.provider.js")];
  delete require.cache[require.resolve("../dist/services/ocr/gemini-prescription-parse.js")];
  delete require.cache[require.resolve("../dist/services/ocr/google-vision-text.js")];

  const mod = require("../dist/services/ocr/ocr-provider.factory.js");

  Object.assign(process.env, previous);

  return mod;
}

test("createOcrProvider returns mock provider when OCR_PROVIDER=mock", () => {
  const { createOcrProvider, currentOcrProviderName } = loadFactoryWithEnv({ OCR_PROVIDER: "mock" });
  assert.equal(currentOcrProviderName(), "mock");
  assert.equal(createOcrProvider().constructor.name, "MockOcrProvider");
});

test("createOcrProvider returns VisionGeminiOcrProvider when OCR_PROVIDER=vision_gemini", () => {
  const { createOcrProvider, currentOcrProviderName } = loadFactoryWithEnv({ OCR_PROVIDER: "vision_gemini" });
  assert.equal(currentOcrProviderName(), "vision_gemini");
  assert.equal(createOcrProvider().constructor.name, "VisionGeminiOcrProvider");
});
