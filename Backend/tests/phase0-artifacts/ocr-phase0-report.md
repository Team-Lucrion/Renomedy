# Phase 0 OCR Accuracy Test Results

Generated: 2026-05-21T12:45:26.687Z

## Test Set

- Total prescriptions: 50
- Printed / typed prescriptions: 25
- Synthetic handwritten-style prescriptions: 25
- Fields scored per prescription: medicine name, strength, dose, frequency, timing, food timing, duration

## Backends Tested

- tesseract_groq

## Accuracy Summary

| Backend | Printed field accuracy | Handwritten field accuracy |
|---|---:|---:|
| tesseract_groq | 100.0% | 94.9% |

## Per-Field Accuracy

| Backend | Field | Accuracy |
|---|---|---:|
| tesseract_groq | medicineName | 100.0% |
| tesseract_groq | strength | 94.0% |
| tesseract_groq | dose | 100.0% |
| tesseract_groq | frequency | 98.0% |
| tesseract_groq | timing | 100.0% |
| tesseract_groq | foodTiming | 90.0% |
| tesseract_groq | duration | 100.0% |

## Confidence Correlation

- tesseract_groq: 0.187

## Raw Results

Machine-readable results: ocr-phase0-results.json

## Notes

- This test set is synthetic and anonymized; it contains no real patient data.
- The handwriting subset is handwritten-style rendered text, not real doctor handwriting.
- Confidence is provider-level medicine confidence, because the current backend model does not expose independent confidence for every field.
