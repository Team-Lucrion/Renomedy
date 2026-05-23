# Phase 0 OCR Blocker-Fix Report

Date: 2026-05-21

## Scope

This is a Phase 0 blocker-fix artifact. No frontend code, product UI, or Phase 1 work was changed.

The intended Phase 0 test is a 50-prescription field-level accuracy benchmark:

- 25 printed / typed synthetic Indian prescriptions
- 25 handwritten-style synthetic Indian prescriptions
- Fields: medicine name, strength, dose, frequency, timing, food timing, duration
- Candidate backends: `direct_gemini`, `tesseract_groq`, `vision_gemini`

The harness for generating the synthetic set and scoring providers is:

- `Backend/tests/phase0-ocr-accuracy.js`

## Fix Applied

The `tesseract_groq` / `prescripto_ai` Groq parser bug was fixed.

Before the fix, the parser treated the full OpenAI-compatible chat-completion response as the prescription payload. The actual medicine JSON is nested in:

```text
choices[0].message.content
```

The parser now unwraps that assistant message content and parses the medicine JSON while preserving the raw Groq response for metadata/debugging.

Focused tests were added in:

- `Backend/tests/groq-prescription-parse.test.js`

## Smoke Test Result

A one-sample smoke test was rerun after the parser fix.

Command:

```powershell
node tests/phase0-ocr-accuracy.js --providers=direct_gemini,tesseract_groq,vision_gemini --limit=1
```

Alias check:

```powershell
node tests/phase0-ocr-accuracy.js --providers=prescripto_ai --limit=1
```

Result artifacts:

- `Backend/tests/phase0-artifacts/ocr-phase0-results.json`
- `Backend/tests/phase0-artifacts/ocr-phase0-report.md`
- `Backend/tests/phase0-artifacts/synthetic-prescriptions/rx-01-printed.jpg`

## Backend Status

| Backend | Smoke status | Blocking issue |
|---|---|---|
| `direct_gemini` | Failed | Gemini API still returns quota exhaustion for `gemini-2.0-flash`. |
| `tesseract_groq` | Parsed | Parser bug fixed. One printed synthetic sample parsed successfully. |
| `prescripto_ai` | Parsed | Alias of `tesseract_groq`; one printed synthetic sample parsed successfully. |
| `vision_gemini` | Failed | Google Cloud Vision API still returns 403 because Cloud Vision is disabled or not yet enabled for the configured project. |

## Latest One-Sample Accuracy

| Backend | Printed field accuracy | Notes |
|---|---:|---|
| `direct_gemini` | 0.0% | Blocked by Gemini quota. |
| `tesseract_groq` | 85.7% | Medicine name, strength, dose, frequency, food timing, and duration passed. Timing failed because the current Groq schema/provider did not return separate morning/night timing. |
| `vision_gemini` | 0.0% | Blocked by disabled Google Cloud Vision API. |

## Why Full Phase 0 Did Not Run

The full Phase 0 benchmark requires at least two usable OCR backends. After the parser fix, only the `tesseract_groq` / `prescripto_ai` path is usable. `direct_gemini` and `vision_gemini` remain externally blocked, so the 50-prescription benchmark still cannot produce the required two-backend comparison.

## Current Architecture Decision

No OCR architecture decision can be made from this run.

The handwritten accuracy gate remains unresolved:

- Above 75 percent: not determined
- 50-75 percent: not determined
- Below 50 percent: not determined

## Required Before Rerun

- Enable Google Cloud Vision API for the configured Google Cloud project, or remove `vision_gemini` from the candidate set.
- Resolve Gemini quota or choose a model/key with available quota before using `direct_gemini`.
- Decide whether `tesseract_groq` should extract a separate timing field beyond food timing before the full benchmark.
- Rerun the benchmark with at least two working backends and all 50 synthetic prescriptions.

## Research Notes

Current candidate categories remain valid for the rerun:

- Google Cloud Vision supports OCR and document text detection, including dense text / handwriting flows: https://cloud.google.com/vision/docs/
- AWS Textract supports document text detection and analysis APIs for extracting text from document images: https://docs.aws.amazon.com/textract/
- Gemini structured outputs are suitable for schema-constrained extraction after OCR, but the output still needs validation before use: https://ai.google.dev/gemini-api/docs/structured-output
- The existing codebase includes `vision_gemini`, `tesseract_groq` / `prescripto_ai`, and `direct_gemini` OCR paths.
