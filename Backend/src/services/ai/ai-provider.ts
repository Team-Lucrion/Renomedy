import type { OcrParsedMedication } from "../ocr/ocr-provider";

export type AiReasoningResult = {
  medications: OcrParsedMedication[];
  warnings: string[];
  rawModelResponse: string;
  modelLatencyMs: number;
  promptVersion: string;
  provider: string;
  model: string;
  retryCount: number;
};

export interface AiProvider {
  reason(text: string, options?: Record<string, unknown>): Promise<AiReasoningResult>;
}
