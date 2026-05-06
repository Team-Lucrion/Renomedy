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
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET
  };

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  process.env.SUPABASE_STORAGE_BUCKET = "prescriptions";
  process.env.CLERK_SECRET_KEY = "clerk_secret";
  process.env.CLERK_WEBHOOK_SECRET = "clerk_webhook_secret";

  Object.assign(process.env, overrides);

  delete require.cache[require.resolve("../dist/config/env.js")];
  delete require.cache[require.resolve("../dist/services/ocr/ocr-provider.factory.js")];
  delete require.cache[require.resolve("../dist/services/ocr/http-ocr.provider.js")];
  delete require.cache[require.resolve("../dist/services/ocr/mock-ocr.provider.js")];

  const mod = require("../dist/services/ocr/ocr-provider.factory.js");

  Object.assign(process.env, previous);

  return mod;
}

test("createOcrProvider returns mock provider by default", () => {
  const { createOcrProvider, currentOcrProviderName } = loadFactoryWithEnv({ OCR_PROVIDER: "mock" });
  assert.equal(currentOcrProviderName(), "mock");
  assert.equal(createOcrProvider().constructor.name, "MockOcrProvider");
});

test("createOcrProvider returns http provider when configured", () => {
  const { createOcrProvider, currentOcrProviderName } = loadFactoryWithEnv({
    OCR_PROVIDER: "http",
    OCR_API_URL: "https://ocr.example.com/parse"
  });
  assert.equal(currentOcrProviderName(), "http");
  assert.equal(createOcrProvider().constructor.name, "HttpOcrProvider");
});
