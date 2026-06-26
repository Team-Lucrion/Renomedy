import { env } from "../../config/env";
import { MockOcrProvider } from "./mock-ocr.provider";
import { TesseractGroqOcrProvider } from "./tesseract-groq-ocr.provider";
import { VisionGeminiOcrProvider } from "./vision-gemini-ocr.provider";
import { DirectGeminiOcrProvider } from "./direct-gemini-ocr.provider";
import { FallbackOcrProvider } from "./fallback-ocr.provider";
import type { OcrProvider } from "./ocr-provider";

export function createOcrProvider(): OcrProvider {
  if (env.OCR_PROVIDER === "mock") {
    return new MockOcrProvider();
  }

  const primary =
    env.OCR_PROVIDER === "tesseract_groq" || env.OCR_PROVIDER === "prescripto_ai"
      ? new TesseractGroqOcrProvider()
      : new VisionGeminiOcrProvider();

  if (!env.GEMINI_API_KEY && process.env.AI_PROVIDER !== "medgemma") {
    return primary;
  }

  return new FallbackOcrProvider(primary, new DirectGeminiOcrProvider(), env.OCR_PROVIDER, "direct_gemini");
}

export function currentOcrProviderName() {
  return env.OCR_PROVIDER;
}
