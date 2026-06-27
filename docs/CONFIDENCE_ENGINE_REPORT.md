# Confidence Engine Architecture Report

## 1. Overview
The Confidence Engine serves as the Trust Layer for the OCR processing pipeline. It evaluates the raw extracted outputs from AI reasoning engines (like MedGemma and Gemini) and assigns an explicit, normalized confidence score and verification requirement. The primary goal is to ensure healthcare safety by aggressively flagging ambiguous or unverified prescriptions for manual review, thus minimizing the risk of false confidence.

## 2. Architecture Diagram

```text
[Mobile App (Frontend)]
       |
       v
[OCR Extraction (ML Kit / Google Vision / Tesseract)]
       | (raw text & metadata)
       v
[AI Structuring (MedGemma / Gemini / Groq)]
       | (JSON structured OcrParsedMedication)
       v
[Schema Validation (Zod)]
       |
       v
[Confidence Engine]  <--- **NEW TRUST LAYER**
       | (Evaluates Medicine Match, Dosage, Timing, OCR Quality)
       | (Appends confidenceScore, confidenceLevel, verificationRequired, reasons)
       v
[Final OcrParseResult]
       |
       v
[Backend DB / Frontend Verification UI]
```

## 3. Scoring Methodology

The engine calculates a score between 0 and 100 based on the following weights:
- **Medicine Match (+30 / 0)**: 30 points if an exact match is found in the Indian medicine catalog (`medicineIntelligence.ts`), 0 otherwise.
- **Dosage (+25 / 0)**: 25 points if strength or dosage text is parsed, 0 if missing.
- **Timing/Frequency (+15 / 0)**: 15 points if frequency or timing is present, 0 if missing.
- **OCR Quality (+15 / +10 / 0)**: 15 points for high quality, 10 for medium, 0 for low.
- **AI Validation (+15 / 0)**: 15 points if schema validation succeeded without forcing a manual review flag during AI reasoning.

## 4. Confidence Categories & Verification Workflow

Based on the calculated score, the engine enforces exactly three categories:

### **High Confidence** (Score >= 85)
- **Criteria**: No critical validation issues, perfectly matched in the medicine catalog, high/medium OCR quality.
- **Workflow**: Auto-accepted by the system. Displayed to the user with a green checkmark.

### **Review Recommended** (Score 60 - 84)
- **Criteria**: Minor ambiguities (e.g., medicine not found in catalog, but all other fields clearly extracted).
- **Workflow**: Preferred default when uncertain. Prompts the user to review the fields but does not strictly block saving.

### **Manual Verification Required** (Score < 60)
- **Criteria**: Missing critical safety information (like dosage/timing), unreadable OCR text, or failed AI validation.
- **Workflow**: Enforces `requiresManualVerification = true`. The UI strictly blocks background saving until the patient manually confirms dosage and timing.

## 5. Integration Points

The Confidence Engine (`Backend/src/utils/confidenceEngine.ts`) is deeply integrated into all provider classes within `Backend/src/services/ocr/`:
- `MlKitMedGemmaProvider`
- `VisionGeminiOcrProvider`
- `DirectGeminiOcrProvider`
- `TesseractGroqOcrProvider`

It hooks into the flow *after* the raw text has been mapped to `OcrParsedMedication` but *before* the result array is bundled into the `OcrParseResult`, ensuring a uniform security posture regardless of the underlying extraction model.

## 6. Future Enhancements

The Trust Layer is designed to be fully backward and forward compatible. Future enhancements will include:
1. **ML Kit Native Confidence**: Utilizing raw bounding box confidence scores directly from ML Kit Document Scanner.
2. **MedGemma Token Probabilities**: Factoring in LLM logprobs for specific dosage extraction.
3. **Continuous Learning**: Adjusting catalog weighting based on historical user corrections (e.g., if users frequently correct "Paracetamol 500" to "Paracetamol 650", the engine will flag future 500mg extractions for manual review).
