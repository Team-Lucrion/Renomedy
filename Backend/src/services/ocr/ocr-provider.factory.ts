import { env } from "../../config/env";
import { MockOcrProvider } from "./mock-ocr.provider";
import { TesseractGroqOcrProvider } from "./tesseract-groq-ocr.provider";
import { VisionGeminiOcrProvider } from "./vision-gemini-ocr.provider";
import type { OcrProvider } from "./ocr-provider";

export function createOcrProvider(): OcrProvider {
  if (env.OCR_PROVIDER === "mock") {
    return new MockOcrProvider();
  }

  if (env.OCR_PROVIDER === "tesseract_groq") {
    return new TesseractGroqOcrProvider();
  }

  return new VisionGeminiOcrProvider();
}

export function currentOcrProviderName() {
  return env.OCR_PROVIDER;
}
