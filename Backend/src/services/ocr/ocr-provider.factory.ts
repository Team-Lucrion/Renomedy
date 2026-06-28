import { env } from "../../config/env";
import { MockOcrProvider } from "./mock-ocr.provider";
import { TesseractGroqOcrProvider } from "./tesseract-groq-ocr.provider";
import { VisionGeminiOcrProvider } from "./vision-gemini-ocr.provider";
import { DirectGeminiOcrProvider } from "./direct-gemini-ocr.provider";
import { FallbackOcrProvider } from "./fallback-ocr.provider";
import { MlKitMedGemmaProvider } from "./mlkit-medgemma.provider";
import type { OcrProvider, OcrParseResult } from "./ocr-provider";
import { confidenceEngine } from "../../utils/confidenceEngine";

/**
 * A wrapper to execute the Trust Layer evaluation on the returned parse result
 * outside of the specific provider implementations.
 */
class ConfidenceWrapperProvider implements OcrProvider {
  constructor(private readonly provider: OcrProvider) {}

  async parsePrescription(imageBuffer: Buffer, metadata?: Record<string, unknown>): Promise<OcrParseResult> {
    const result = await this.provider.parsePrescription(imageBuffer, metadata);

    // Evaluate the prescription as a whole using the new Trust Layer
    if (result.medications && result.medications.length > 0) {
      // Determine OCR Quality
      let ocrQuality: "high" | "medium" | "low" = "medium";
      if (result.cardData?.ocr_quality === "high" || result.cardData?.ocr_quality === "medium" || result.cardData?.ocr_quality === "low") {
        ocrQuality = result.cardData.ocr_quality;
      }

      const updatedMedications = confidenceEngine.evaluatePrescription(result.medications, { ocrQuality });
      result.medications = updatedMedications;

      // Update card data summary if exists
      if (result.cardData && result.cardData.medicines) {
        result.cardData.medicines = updatedMedications.map((med, idx) => {
          const originalCardMed = result.cardData!.medicines[idx];
          return {
            ...originalCardMed,
            confidenceLevel: med.confidenceLevel,
            riskFlags: med.riskFlags
          };
        });
      }
    }

    return result;
  }
}

export function createOcrProvider(): OcrProvider {
  let provider: OcrProvider;

  if (env.OCR_PROVIDER === "mock") {
    provider = new MockOcrProvider();
  } else if (env.OCR_PROVIDER === "mlkit_medgemma") {
    provider = new MlKitMedGemmaProvider();
  } else {
    const primary =
      env.OCR_PROVIDER === "tesseract_groq" || env.OCR_PROVIDER === "prescripto_ai"
        ? new TesseractGroqOcrProvider()
        : new VisionGeminiOcrProvider();

    if (!env.GEMINI_API_KEY) {
      provider = primary;
    } else {
      provider = new FallbackOcrProvider(primary, new DirectGeminiOcrProvider(), env.OCR_PROVIDER, "direct_gemini");
    }
  }

  return new ConfidenceWrapperProvider(provider);
}

export function currentOcrProviderName() {
  return env.OCR_PROVIDER;
}
