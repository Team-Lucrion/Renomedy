const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Mock env vars before anything requiring env.js runs
process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.CLERK_SECRET_KEY = "clerk-secret-key";
process.env.CLERK_WEBHOOK_SECRET = "clerk-webhook-secret";

test("normalizeGoogleVisionPrivateKey converts escaped newlines", () => {
  const { normalizeGoogleVisionPrivateKey } = require("../dist/services/ocr/google-vision-text.js");
  const normalized = normalizeGoogleVisionPrivateKey("line1\\nline2\\nline3\\n");
  assert.equal(normalized, "line1\nline2\nline3");
});

test("resolveGoogleVisionCredentialsPath resolves relative paths from backend root", () => {
  const { resolveGoogleVisionCredentialsPath } = require("../dist/services/ocr/google-vision-text.js");
  const filename = "tmp-google-vision-test.json";
  const backendFile = path.join(__dirname, "..", filename);

  fs.writeFileSync(backendFile, "{\"ok\":true}\n", "utf8");

  try {
    const resolved = resolveGoogleVisionCredentialsPath(`./${filename}`);
    assert.equal(path.normalize(resolved), path.normalize(backendFile));
  } finally {
    fs.unlinkSync(backendFile);
  }
});
