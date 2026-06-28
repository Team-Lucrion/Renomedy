const test = require("node:test");
const assert = require("node:assert/strict");

function loadFactoryWithEnv(overrides) {
  const previous = {
    OCR_PROVIDER: process.env.OCR_PROVIDER,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY
  };

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  process.env.SUPABASE_STORAGE_BUCKET = "prescriptions";
  process.env.CLERK_SECRET_KEY = "clerk_secret";
  process.env.CLERK_WEBHOOK_SECRET = "clerk_webhook_secret";
  process.env.GEMINI_API_KEY = "";

  Object.assign(process.env, overrides);

  delete require.cache[require.resolve("../dist/config/env.js")];
  delete require.cache[require.resolve("../dist/services/ocr/ocr-provider.factory.js")];
  delete require.cache[require.resolve("../dist/services/ocr/mock-ocr.provider.js")];
  delete require.cache[require.resolve("../dist/services/ocr/tesseract-groq-ocr.provider.js")];
  delete require.cache[require.resolve("../dist/services/ocr/vision-gemini-ocr.provider.js")];

  const factory = require("../dist/services/ocr/ocr-provider.factory.js");
  const result = factory.createOcrProvider();

  Object.assign(process.env, previous);
  return result;
}

test("createOcrProvider returns wrapped mock provider when OCR_PROVIDER=mock", () => {
  const provider = loadFactoryWithEnv({ OCR_PROVIDER: "mock" });
  assert.equal(provider.constructor.name, "ConfidenceWrapperProvider");
  assert.equal(provider.provider.constructor.name, "MockOcrProvider");
});

test("createOcrProvider returns wrapped VisionGeminiOcrProvider when OCR_PROVIDER=vision_gemini", () => {
  const provider = loadFactoryWithEnv({ OCR_PROVIDER: "vision_gemini" });
  assert.equal(provider.constructor.name, "ConfidenceWrapperProvider");
  assert.equal(provider.provider.constructor.name, "VisionGeminiOcrProvider");
});

test("createOcrProvider accepts PrescriptoAI alias for Tesseract plus Groq", () => {
  const provider = loadFactoryWithEnv({ OCR_PROVIDER: "prescripto_ai" });
  assert.equal(provider.constructor.name, "ConfidenceWrapperProvider");
  assert.equal(provider.provider.constructor.name, "TesseractGroqOcrProvider");
});

test("createOcrProvider returns MlKitMedGemmaProvider when configured", () => {
  const provider = loadFactoryWithEnv({ OCR_PROVIDER: "mlkit_medgemma" });
  assert.equal(provider.constructor.name, "ConfidenceWrapperProvider");
  assert.equal(provider.provider.constructor.name, "MlKitMedGemmaProvider");
});
