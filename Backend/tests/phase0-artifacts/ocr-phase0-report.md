# Phase 0 OCR Accuracy Test Results

Generated: 2026-09-06T06:25:27.571Z

## Test Set

- Total prescriptions: 50
- Printed / typed prescriptions: 25
- Synthetic handwritten-style prescriptions: 25
- Fields scored per prescription: medicine name, strength, dose, frequency, timing, food timing, duration

## Backends Tested

- direct_gemini
- tesseract_groq

## Accuracy Summary

| Backend | Printed field accuracy | Handwritten field accuracy |
|---|---:|---:|
| direct_gemini | 0.0% | 0.0% |
| tesseract_groq | 0.0% | 0.0% |

## Per-Field Accuracy

| Backend | Field | Accuracy |
|---|---|---:|
| direct_gemini | medicineName | 0.0% |
| direct_gemini | strength | 0.0% |
| direct_gemini | dose | 0.0% |
| direct_gemini | frequency | 0.0% |
| direct_gemini | timing | 0.0% |
| direct_gemini | foodTiming | 0.0% |
| direct_gemini | duration | 0.0% |
| tesseract_groq | medicineName | 0.0% |
| tesseract_groq | strength | 0.0% |
| tesseract_groq | dose | 0.0% |
| tesseract_groq | frequency | 0.0% |
| tesseract_groq | timing | 0.0% |
| tesseract_groq | foodTiming | 0.0% |
| tesseract_groq | duration | 0.0% |

## Confidence Correlation

- direct_gemini: not available
- tesseract_groq: not available

## Raw Results

Machine-readable results: ocr-phase0-results.json

## Notes

- This test set is synthetic and anonymized; it contains no real patient data.
- The handwriting subset is handwritten-style rendered text, not real doctor handwriting.
- Confidence is provider-level medicine confidence, because the current backend model does not expose independent confidence for every field.
