import type { OcrParseResult, OcrProvider } from "./ocr-provider";
import { logger } from "../../config/logger";

function shouldFallback(result: OcrParseResult) {
  return result.parseStatus === "failed" || result.medications.length === 0;
}

function summarizeFailure(result?: OcrParseResult, error?: unknown) {
  if (result) {
    return {
      parseStatus: result.parseStatus,
      medicationsDetected: result.medications.length,
      providerMetadata: result.providerMetadata
    };
  }

  return {
    error: error instanceof Error ? error.message : String(error)
  };
}

export class FallbackOcrProvider implements OcrProvider {
  constructor(
    private readonly primary: OcrProvider,
    private readonly fallback: OcrProvider,
    private readonly primaryName: string,
    private readonly fallbackName: string
  ) {}

  async parsePrescription(imageBuffer: Buffer, metadata?: Record<string, unknown>): Promise<OcrParseResult> {
    let primaryResult: OcrParseResult | undefined;

    try {
      primaryResult = await this.primary.parsePrescription(imageBuffer, metadata);
      if (!shouldFallback(primaryResult)) {
        return primaryResult;
      }
    } catch (error) {
      logger.warn({ primaryProvider: this.primaryName, fallbackProvider: this.fallbackName, error: error instanceof Error ? error.message : "Unknown error" }, "Primary OCR provider failed abruptly, engaging fallback");
      const fallbackResult = await this.fallback.parsePrescription(imageBuffer, metadata);
      return {
        ...fallbackResult,
        providerMetadata: {
          ...fallbackResult.providerMetadata,
          fallback_from: this.primaryName,
          fallback_provider: this.fallbackName,
          primary_failure: summarizeFailure(undefined, error)
        }
      };
    }

    logger.info({ primaryProvider: this.primaryName, fallbackProvider: this.fallbackName, parseStatus: primaryResult.parseStatus, medicationsDetected: primaryResult.medications.length }, "Primary OCR provider yielded poor results, engaging fallback");
    const fallbackResult = await this.fallback.parsePrescription(imageBuffer, metadata);
    if (!shouldFallback(fallbackResult)) {
      logger.info({ fallbackProvider: this.fallbackName }, "Fallback OCR provider successfully salvaged prescription");
      return {
        ...fallbackResult,
        providerMetadata: {
          ...fallbackResult.providerMetadata,
          fallback_from: this.primaryName,
          fallback_provider: this.fallbackName,
          primary_failure: summarizeFailure(primaryResult)
        }
      };
    }

    logger.warn({ primaryProvider: this.primaryName, fallbackProvider: this.fallbackName }, "Both primary and fallback OCR providers failed to parse prescription");
    return {
      ...primaryResult,
      providerMetadata: {
        ...primaryResult.providerMetadata,
        fallback_attempted: this.fallbackName,
        fallback_failure: summarizeFailure(fallbackResult)
      }
    };
  }
}
