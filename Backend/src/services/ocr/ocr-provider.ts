export type OcrParsedMedication = {
  medicineName: string;
  dosage?: string;
  frequency?: string;
  timing?: string;
  duration?: string;
  shorthandDetected: string[];
  shorthandExplanation?: string;
  confidenceScore: number;
  requiresManualVerification: boolean;
};

export type OcrParseResult = {
  rawText: string;
  parseStatus: "pending" | "parsed" | "verified" | "failed";
  medications: OcrParsedMedication[];
  providerMetadata?: Record<string, unknown>;
};

export interface OcrProvider {
  parsePrescription(imageBuffer: Buffer): Promise<OcrParseResult>;
}
