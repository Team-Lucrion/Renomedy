# Confidence Engine Architecture Report (v2 - Trust Layer)

## 1. Overview
The Confidence Engine has been upgraded into a second-generation Trust Layer for the OCR processing pipeline. It enforces context-aware evaluation for an entire prescription and applies strict healthcare risk overriding logic. The goal is to maximize healthcare safety by utilizing risk flags to catch missing data, contradictory fields, and suspicious patterns, prioritizing patient safety over basic extraction confidence.

## 2. Architecture Diagram & Centralization

```text
[Mobile App (Frontend)]
       |
       v
[OCR Extraction (ML Kit / Google Vision / Tesseract)]
       |
       v
[AI Structuring (MedGemma / Gemini / Groq)]
       |
       v
[Schema Validation (Zod)]
       |
       v
[OcrProviderFactory (ConfidenceWrapperProvider)]  <--- **CENTRALIZED TRUST LAYER**
       | (Evaluates entire OcrParseResult using ConfidenceEngine.evaluatePrescription)
       | (Analyzes medicine context, cross-field consistency, and duplicates)
       | (Appends confidenceScore, confidenceLevel, verificationRequired, reasons, riskFlags)
       v
[Final OcrParseResult]
       |
       v
[Backend DB / Frontend Verification UI]
```

## 3. Risk Flag Architecture

We introduced a strict enum-based Risk Flag system designed for modularity and future expansion. Current flags include:
- **`MISSING_DOSAGE`**: Required strength or dosage missing.
- **`UNKNOWN_MEDICINE`**: Medicine could not be mapped to the local catalog.
- **`AMBIGUOUS_TIMING`**: Timing or frequency missing.
- **`LOW_OCR_QUALITY`**: Text extraction quality reported as low.
- **`FAILED_VALIDATION`**: JSON structuring bypassed standard schema guardrails.
- **`INCOMPLETE_PRESCRIPTION`**: Extracted text appears truncated.
- **`DUPLICATE_MEDICATION_DETECTED`**: Same medicine detected 3+ times.
- **`SUSPICIOUS_MEDICATION_PATTERN`**: Contradictory dosages (e.g., Paracetamol 500mg and 650mg on same script) or contradictory frequencies (e.g., OD and TDS).

## 4. Scoring Methodology & Trust Signals

The base score (0-100) utilizes modular Trust Signals:
- **Medicine Match (+30 / 0)**: Matches catalog.
- **Dosage (+25 / 0)**: Dosage extracted.
- **Timing/Frequency (+15 / 0)**: Frequency/timing extracted.
- **OCR Quality (+15 / +10 / 0)**: High/medium OCR quality text payload.
- **AI Validation (+15 / 0)**: Successful AI schema extraction.

## 5. Critical Override Logic & Healthcare Safety Rules

Verification levels are **NOT** determined by score alone. Patient safety overrides score.

- **High Confidence**: Score >= 85 AND *no critical risk flags*.
- **Review Recommended**: Score 60-84 AND *no critical risk flags*.
- **Manual Verification Required**: Score < 60 OR *any critical risk flag is present*.

**Examples of overrides**:
- `95 + MISSING_DOSAGE -> MANUAL_VERIFICATION_REQUIRED`
- `92 + FAILED_VALIDATION -> MANUAL_VERIFICATION_REQUIRED`
- `88 + SUSPICIOUS_MEDICATION_PATTERN -> MANUAL_VERIFICATION_REQUIRED`
- `78 + (No Flags) -> REVIEW_RECOMMENDED`

## 6. Verification Classification Flow

1. AI models return structured JSON payload.
2. `ConfidenceWrapperProvider` catches the payload and extracts all medicines.
3. `ConfidenceEngine` pre-processes the medicines, grouping them by normalized names.
4. Each medicine is evaluated against base scores and cross-referenced with siblings to trigger contextual flags (Rule A, B, C, D).
5. Output fields (`confidenceScore`, `confidenceLevel`, `requiresManualVerification`, `riskFlags`, `confidenceReasons`) are mapped back onto the objects.

## 7. Example Confidence Outputs

```json
{
  "medicineName": "Paracetamol",
  "dosage": "500mg",
  "frequency": "OD",
  "confidenceScore": 85,
  "confidenceLevel": "High Confidence",
  "requiresManualVerification": false,
  "riskFlags": [],
  "confidenceReasons": [
    "Medicine perfectly matched in catalog: Paracetamol (+30)",
    "Dosage extracted (+25)",
    "Timing/Frequency extracted (+15)",
    "Medium OCR text quality (+10)"
  ]
}
```

```json
{
  "medicineName": "UnknownDrug",
  "dosage": "",
  "frequency": "TDS",
  "confidenceScore": 40,
  "confidenceLevel": "Manual Verification Required",
  "requiresManualVerification": true,
  "riskFlags": ["UNKNOWN_MEDICINE", "MISSING_DOSAGE"],
  "confidenceReasons": [
    "Medicine not found in catalog (0)",
    "Missing dosage/strength (0)",
    "Timing/Frequency extracted (+15)",
    "High OCR text quality (+15)"
  ]
}
```

## 8. Future Expansion Strategy

- **Future ML Kit Confidence Integration**: Mapping ML Kit bounding box block probabilities to modify the `ocrQuality` sub-score.
- **Future MedGemma Confidence Integration**: Extracting logprobs from the MedGemma token stream to apply direct scaling to the overall AI Validation score.
- **Future Learning-Based Trust Signals**: Incorporating continuous learning rules based on user manual correction events.
