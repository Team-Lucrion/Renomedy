const test = require("node:test");
const assert = require("node:assert/strict");

const { scanPrescriptionHandler } = require("../dist/modules/prescriptions/prescriptions.controller.js");

const prescriptionsService = require("../dist/modules/prescriptions/prescriptions.service.js");

test("scanPrescriptionHandler - NO_IMAGE returns 400 with NO_IMAGE code", async () => {
  const originalResolve = prescriptionsService.resolvePrescriptionScanFile;
  prescriptionsService.resolvePrescriptionScanFile = async () => null;

  const req = { file: undefined, body: {} };
  const res = {
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.body = data;
      return this;
    }
  };

  await scanPrescriptionHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "NO_IMAGE");

  prescriptionsService.resolvePrescriptionScanFile = originalResolve;
});

test("scanPrescriptionHandler - gracefully handles OCR extractedText fallback parsing", async () => {
  const originalResolve = prescriptionsService.resolvePrescriptionScanFile;
  prescriptionsService.resolvePrescriptionScanFile = async () => ({ mimetype: "image/jpeg", buffer: Buffer.from("fake") });

  const originalDecode = prescriptionsService.decodePrescriptionUpload;
  prescriptionsService.decodePrescriptionUpload = async ({ body }) => {
    return {
      cleaned_ocr_text: body.extractedText || "Fallback Server OCR text",
      confidence: 90
    };
  };

  const originalMap = prescriptionsService.mapPrescriptionToScanResponse;
  prescriptionsService.mapPrescriptionToScanResponse = (data) => {
    return {
      success: true,
      rawText: data.cleaned_ocr_text,
    };
  };

  const req = {
    auth: { token: "fake-jwt", clerkUserId: "user1" },
    file: { mimetype: "image/jpeg", buffer: Buffer.from("fake") },
    body: { extractedText: "Edge OCR text" }
  };
  const res = {
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.body = data;
      return this;
    }
  };

  await scanPrescriptionHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body);
  assert.equal(res.body.rawText, "Edge OCR text");

  prescriptionsService.resolvePrescriptionScanFile = originalResolve;
  prescriptionsService.decodePrescriptionUpload = originalDecode;
  prescriptionsService.mapPrescriptionToScanResponse = originalMap;
});

test("resolvePrescriptionScanFile throws UNSUPPORTED_FILE_TYPE for invalid mimetypes via HttpError", async () => {
  const { HttpError } = require("../dist/utils/http-error.js");
  const originalResolve = prescriptionsService.resolvePrescriptionScanFile;
  prescriptionsService.resolvePrescriptionScanFile = async () => {
    throw new HttpError(400, "Unsupported file type", { scanError: "UNSUPPORTED_FILE_TYPE" });
  };

  const req = { file: { mimetype: "application/pdf" }, body: {} };
  const res = {
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.body = data;
      return this;
    }
  };

  await scanPrescriptionHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "UNSUPPORTED_FILE_TYPE");

  prescriptionsService.resolvePrescriptionScanFile = originalResolve;
});
