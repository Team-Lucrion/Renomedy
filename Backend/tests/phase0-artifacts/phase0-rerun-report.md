# Phase 0 OCR Rerun Report

Date: 2026-05-21

## Scope

This rerun followed `prompt.txt` after the Groq parser fix.

- Phase 1 was not started.
- Frontend was not changed.
- Product UI code was not changed.
- Backend production UI response shape was not changed.

## Backend Tested

- `tesseract_groq` / `prescripto_ai`

`tesseract_groq` is the working backend after the Groq chat-completion parsing fix. `prescripto_ai` is an alias for the same provider path.

## Test Set

- Total prescriptions: 50
- Printed / typed synthetic prescriptions: 25
- Handwritten-style synthetic prescriptions: 25
- Fields scored per prescription:
  - Medicine name
  - Strength
  - Dose
  - Frequency
  - Timing
  - Food timing
  - Duration

Artifacts:

- `Backend/tests/phase0-artifacts/ocr-phase0-results.json`
- `Backend/tests/phase0-artifacts/ocr-phase0-report.md`
- `Backend/tests/phase0-artifacts/synthetic-prescriptions/`

## Parse Status

| Kind | Parsed samples | Failed samples |
|---|---:|---:|
| Printed / typed | 25 | 0 |
| Handwritten-style | 25 | 0 |

## Accuracy Summary

| Backend | Printed field accuracy | Handwritten field accuracy |
|---|---:|---:|
| `tesseract_groq` | 85.7% | 87.4% |

## Per-Field Accuracy

| Field | Overall accuracy | Printed accuracy | Handwritten accuracy |
|---|---:|---:|---:|
| Medicine name | 100.0% | 100.0% | 100.0% |
| Strength | 94.0% | 100.0% | 88.0% |
| Dose | 100.0% | 100.0% | 100.0% |
| Frequency | 100.0% | 100.0% | 100.0% |
| Timing | 32.0% | 0.0% | 64.0% |
| Food timing | 80.0% | 100.0% | 60.0% |
| Duration | 100.0% | 100.0% | 100.0% |

## Common Error Types

| Error type | Count | Notes |
|---|---:|---|
| Timing mismatch / missing separate timing | 34 | The provider frequently mapped timing to food timing such as `after food`, `before food`, or `PC`, instead of morning/night/bedtime/as needed. Printed samples were especially affected because timing and food timing are separate labels. |
| Food timing mismatch | 10 | Most failures occurred in handwritten-style samples where shorthand or phrasing such as `PC`, `AC`, `with food`, `before meal`, or `at night` was interpreted inconsistently. |
| Strength missing | 3 | Three handwritten-style samples parsed the medicine but missed the strength value. |

## Confidence

- Provider-level confidence correlation with field correctness: `0.1122`.
- The current backend does not expose independent confidence per field, so Phase 2 confidence flagging should treat the provider confidence as coarse-grained only unless field-level confidence is added.

## Architecture Decision Gate

The chosen working backend's handwritten-style field accuracy is **87.4%**.

Gate result:

- **Above 75%**
- Architecture decision: OCR can be presented as an equal-weight primary assist alongside manual entry.
- Confidence flagging is still required on low-confidence fields.

Important caveat: this result is based on synthetic handwritten-style prescriptions, not real doctor handwriting. Before beta, this should be repeated with anonymized real prescriptions if available.

## Remaining External Blockers

| Backend | Status | Blocker |
|---|---|---|
| `direct_gemini` | Blocked | Gemini API quota remains exhausted for `gemini-2.0-flash`. |
| `vision_gemini` | Blocked | Google Cloud Vision API remains disabled / unavailable for the configured project, returning 403. |

## Recommendations Before Phase 2

- Proceed with `tesseract_groq` / `prescripto_ai` as the measured working backend for now.
- Treat OCR as equal-weight assist based on the synthetic handwritten-style result.
- Add explicit field-level review emphasis for timing and food timing because those are the dominant error classes.
- Do not rely on provider confidence as field-level confidence until the backend returns per-field scores.
- Consider adding a separate `timing` extraction field to the Groq schema before the full beta OCR test, because the current schema separates `foodTiming` but not morning/night timing cleanly.

