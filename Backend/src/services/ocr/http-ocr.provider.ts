import { env } from "../../config/env";
import type { OcrParseResult, OcrProvider } from "./ocr-provider";

type HttpOcrResponse = OcrParseResult & {
  providerMetadata?: Record<string, unknown>;
};

export class HttpOcrProvider implements OcrProvider {
  async parsePrescription(imageBuffer: Buffer): Promise<OcrParseResult> {
    if (!env.OCR_API_URL) {
      throw new Error("OCR_API_URL is required for http OCR provider");
    }

    const response = await fetch(env.OCR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.OCR_API_KEY ? { Authorization: `Bearer ${env.OCR_API_KEY}` } : {})
      },
      body: JSON.stringify({
        imageBase64: imageBuffer.toString("base64"),
        mimeType: "image/jpeg"
      })
    });

    if (!response.ok) {
      throw new Error(`OCR provider request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as HttpOcrResponse;
    if (!payload || !Array.isArray(payload.medications) || typeof payload.rawText !== "string") {
      throw new Error("OCR provider returned an invalid response");
    }

    return {
      rawText: payload.rawText,
      parseStatus: payload.parseStatus,
      medications: payload.medications
    };
  }
}
