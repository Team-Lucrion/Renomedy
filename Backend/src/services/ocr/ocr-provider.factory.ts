import { env } from "../../config/env";
import { HttpOcrProvider } from "./http-ocr.provider";
import { MockOcrProvider } from "./mock-ocr.provider";
import type { OcrProvider } from "./ocr-provider";

export function createOcrProvider(): OcrProvider {
  if (env.OCR_PROVIDER === "http") {
    return new HttpOcrProvider();
  }

  return new MockOcrProvider();
}

export function currentOcrProviderName() {
  return env.OCR_PROVIDER;
}
