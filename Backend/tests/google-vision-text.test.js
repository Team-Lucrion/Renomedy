const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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
