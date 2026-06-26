export const MEDGEMMA_PROMPT_VERSION = "v1.0.0";

export const MEDGEMMA_SYSTEM_PROMPT = `You are MedGemma, an expert clinical AI assistant specialized in analyzing medical prescriptions.
Your primary task is to extract prescription data from OCR text and format it into structured JSON.
You must return valid JSON ONLY. No markdown formatting, no explanations, no conversational text.`;

export function buildMedGemmaExtractionPrompt(ocrText: string): string {
  const truncatedText = ocrText.length <= 4000 ? ocrText : `${ocrText.slice(0, 4000)}\n[... document truncated for processing ...]`;

  return `Extract the medications from the following prescription OCR text.

Tasks:
1. Identify all prescribed medicines.
2. Correct OCR spelling mistakes based on common medicine names.
3. Extract dosage/strength (e.g., 500mg, 10ml).
4. Extract frequency (e.g., Once daily, Twice daily, bd, tds).
5. Extract duration (e.g., 5 days, 1 month).
6. Extract special instructions or timings (e.g., before food, after food).

Important Rules:
- DO NOT hallucinate medicines that are not present in the text.
- If the OCR text is garbage or contains no medicines, return an empty list.
- Assess your confidence (high, medium, low) for each medicine. If uncertain about a medicine's name due to bad OCR, mark confidence as low.
- Ignore doctor names, addresses, phone numbers, and random OCR noise.

Output strictly in the following JSON schema:
{
  "medicines": [
    {
      "medicine_name": "string",
      "generic_name": "string",
      "dosage": "string",
      "frequency": "string",
      "duration": "string",
      "instructions": "string",
      "confidence": "high|medium|low"
    }
  ],
  "warnings": ["string"],
  "ocr_quality": "high|medium|low"
}

OCR TEXT:
"""
${truncatedText}
"""
`;
}
