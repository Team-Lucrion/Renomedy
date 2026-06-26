import { OcrParsedMedication, OcrCardData } from "../ocr/ocr-provider";

export type AiParseResult = {
  rawText: string;
  cleanedText?: string;
  parseStatus: "pending" | "parsed" | "verified" | "failed";
  medications: OcrParsedMedication[];
  cardData?: OcrCardData;
  aiProvider: string;
  aiModel: string;
  rawModelResponse?: string;
  providerMetadata?: Record<string, unknown>;
};

export interface AiProvider {
  /**
   * Process prescription details (OCR text, segmentation, etc) to extract structured medicines.
   *
   * @param ocrText The raw extracted OCR text
   * @param ocrMetadata Optional metadata from the OCR process
   * @param segmentation Optional segmentation data (e.g. bounding boxes)
   */
  processPrescription(ocrText: string, ocrMetadata?: Record<string, unknown>, segmentation?: Record<string, unknown>): Promise<AiParseResult>;
}
