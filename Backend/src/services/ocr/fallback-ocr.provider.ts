import type { OcrParseResult, OcrProvider } from "./ocr-provider";

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

  async parsePrescription(
    imageBuffer: Buffer,
    options?: { extractedText?: string; ocrMetadata?: Record<string, unknown> }
  ): Promise<OcrParseResult> {
    let primaryResult: OcrParseResult | undefined;

    try {
      primaryResult = await this.primary.parsePrescription(imageBuffer, options);
      if (!shouldFallback(primaryResult)) {
        return primaryResult;
      }
    } catch (error) {
      const fallbackResult = await this.fallback.parsePrescription(imageBuffer, options);
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

    const fallbackResult = await this.fallback.parsePrescription(imageBuffer, options);
    if (!shouldFallback(fallbackResult)) {
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
