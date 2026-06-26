import type { OcrParseResult, OcrProvider } from "./ocr-provider";

export class MockOcrProvider implements OcrProvider {
  async parsePrescription(
    _imageBuffer: Buffer,
    options?: { extractedText?: string; ocrMetadata?: Record<string, unknown> }
  ): Promise<OcrParseResult> {
    if (options?.extractedText) {
      return {
        rawText: options.extractedText,
        cleanedText: options.extractedText,
        parseStatus: "parsed",
        aiProvider: "mock",
        aiModel: "edge-test",
        medications: [
          {
            medicineName: "Edge-Extracted Mock Medicine",
            dosage: "1 tablet",
            frequency: "Daily",
            shorthandDetected: [],
            confidenceScore: 0.95,
            requiresManualVerification: false
          }
        ],
        providerMetadata: {
          provider: "mock",
          ocr_engine: "ml-kit-edge",
          edge_metadata: options.ocrMetadata
        }
      };
    }

    return {
      rawText: "Rx: Metformin 500mg BD PC, Atorvastatin 20mg HS, Thyroxine 50mcg OD AC, SOS for severe symptoms",
      cleanedText: "Rx: Metformin 500mg BD PC, Atorvastatin 20mg HS, Thyroxine 50mcg OD AC, SOS for severe symptoms",
      parseStatus: "parsed",
      aiProvider: "mock",
      aiModel: "deterministic-fixture",
      rawModelResponse: "{\"medicines\":[{\"medicine_name\":\"Metformin\"}]}",
      providerMetadata: { provider: "mock", mode: "deterministic-fixture" },
      medications: [
        {
          medicineName: "Metformin",
          dosage: "500mg",
          frequency: "Twice daily",
          timing: "Morning and evening",
          duration: "90 days",
          instructions: "Take after food",
          shorthandDetected: ["BD", "PC"],
          shorthandExplanation: "BD = twice daily, PC = after food",
          confidenceScore: 0.92,
          requiresManualVerification: true
        },
        {
          medicineName: "Atorvastatin",
          dosage: "20mg",
          frequency: "Once daily",
          timing: "Bedtime",
          duration: "90 days",
          instructions: "Take at night",
          shorthandDetected: ["HS"],
          shorthandExplanation: "HS = at bedtime",
          confidenceScore: 0.9,
          requiresManualVerification: true
        },
        {
          medicineName: "Thyroxine",
          dosage: "50mcg",
          frequency: "Once daily",
          timing: "Before breakfast",
          duration: "90 days",
          instructions: "Take on an empty stomach",
          shorthandDetected: ["OD", "AC", "SOS"],
          shorthandExplanation: "OD = once daily, AC = before food, SOS = only when needed",
          confidenceScore: 0.88,
          requiresManualVerification: true
        }
      ]
    };
  }
}
