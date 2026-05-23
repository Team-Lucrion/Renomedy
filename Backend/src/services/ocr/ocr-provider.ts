export type OcrParsedMedication = {
  medicineName: string;
  genericName?: string;
  strength?: string;
  form?: string;
  dose?: string;
  dosage?: string;
  frequency?: string;
  timing?: string;
  foodTiming?: string;
  duration?: string;
  instructions?: string;
  uses?: string[];
  warnings?: string[];
  quantity?: string;
  confidence?: "high" | "medium" | "low";
  shorthandDetected: string[];
  shorthandExplanation?: string;
  confidenceScore: number;
  requiresManualVerification: boolean;
};

export type OcrCardMedication = {
  id: number;
  medicine_name: string;
  generic_name: string;
  strength: string;
  form: string;
  dose: string;
  frequency: string;
  timing: string;
  duration: string;
  instructions: string;
  uses: string[];
  warnings: string[];
  quantity: string;
  confidence: "high" | "medium" | "low";
};

export type OcrCardData = {
  status: "success" | "failed";
  ocr_quality: "high" | "medium" | "low";
  prescription_summary: {
    total_medicines: number;
    confidence_score: number;
  };
  medicines: OcrCardMedication[];
  important_notes: string[];
  raw_detected_text_summary: string;
};

export type OcrParseResult = {
  rawText: string;
  cleanedText?: string;
  parseStatus: "pending" | "parsed" | "verified" | "failed";
  medications: OcrParsedMedication[];
  cardData?: OcrCardData;
  aiProvider?: string;
  aiModel?: string;
  rawModelResponse?: string;
  providerMetadata?: Record<string, unknown>;
};

export interface OcrProvider {
  parsePrescription(imageBuffer: Buffer): Promise<OcrParseResult>;
}
