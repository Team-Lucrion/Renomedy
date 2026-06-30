# Renomedy QA & Test Coverage Execution Plan

## Executive Summary
This document outlines the detailed plan to address the QA audit findings for Renomedy's OCR and AI clinical reasoning pipeline. The plan focuses on ensuring patient safety, prescription accuracy, and system reliability, specifically targeting the missing test coverage identified as critical P0 and P1 risks.

## Part 1 — Confidence Engine Deep Analysis

### Risk Flags Analysis
The `ConfidenceEngine` defines the following `RiskFlag` types:
*   `MISSING_DOSAGE`: Triggered when dosage/strength is empty. Critical.
*   `UNKNOWN_MEDICINE`: Triggered when a medicine is not found in the catalog.
*   `AMBIGUOUS_TIMING`: Triggered when timing/frequency is empty.
*   `LOW_OCR_QUALITY`: Triggered when OCR quality is reported as low. Critical.
*   `FAILED_VALIDATION`: Triggered when AI validation failed. Critical.
*   `INCOMPLETE_PRESCRIPTION`: Placeholder for future use. Critical.
*   `DUPLICATE_MEDICATION_DETECTED`: Triggered when a medicine appears 3+ times. Critical.
*   `SUSPICIOUS_MEDICATION_PATTERN`: Triggered on 3+ occurrences, conflicting strengths, conflicting frequencies, or valid medicine with missing dosage/timing. Critical.
*   `MISSING_CRITICAL_DURATION`: Triggered for high-risk duration medicines without duration. Critical.
*   `MISSING_DURATION_WARNING`: Triggered for non-high-risk medicines without duration.
*   `CRITICAL_MONITORED_MEDICINE`: Triggered for specific critical medicines. Critical.
*   `HIGH_ATTENTION_MEDICINE`: Triggered for high attention medicines.
*   `UNCERTAIN_DOSAGE_PATTERN`: Triggered for abnormal dosage patterns without catalog match.

### Confidence Score Boundaries
*   `High Confidence`: Score >= 85 (and no critical flags).
*   `Review Recommended`: Score >= 60 and < 85 (and no critical flags).
*   `Manual Verification Required`: Score < 60 OR presence of any critical flag.

### Verification-Level Overrides
Critical flags explicitly override the verification level to `Manual Verification Required` and set `verificationRequired` to `true`, regardless of the base score.

### Test Matrix

1.  **Perfect Prescription Scenario**
    *   *Input:* Known catalog medicine (e.g., 'Dolo 650'), valid dosage, valid timing, high OCR quality.
    *   *Expected Output:* Score 85+, `High Confidence`, no critical flags.
    *   *Rationale:* Baseline functionality verification.

2.  **Missing Dosage (P0)**
    *   *Input:* Known medicine, empty dosage/strength.
    *   *Expected Output:* `MISSING_DOSAGE` flag, `Manual Verification Required`.
    *   *Rationale:* Prevents potentially dangerous dosing errors.

3.  **Critical Monitored Medicine (P0)**
    *   *Input:* Medicine flagged as critical (e.g., Methotrexate, Insulin - requires mock/setup).
    *   *Expected Output:* `CRITICAL_MONITORED_MEDICINE` flag, `Manual Verification Required`.
    *   *Rationale:* Ensures highest scrutiny for dangerous drugs.

4.  **Suspicious Pattern: Conflicting Strengths (P0)**
    *   *Input:* Two entries for the same medicine but different strengths.
    *   *Expected Output:* `SUSPICIOUS_MEDICATION_PATTERN` flag, `Manual Verification Required`.
    *   *Rationale:* Detects potential OCR hallucination or contradictory prescription logic.

5.  **Suspicious Pattern: Conflicting Frequencies (P0)**
    *   *Input:* Two entries for the same medicine but different frequencies.
    *   *Expected Output:* `SUSPICIOUS_MEDICATION_PATTERN` flag, `Manual Verification Required`.
    *   *Rationale:* Detects potential OCR hallucination or contradictory prescription logic.

6.  **Missing Critical Duration (P0)**
    *   *Input:* Medicine requiring duration (e.g., antibiotics) with empty duration.
    *   *Expected Output:* `MISSING_CRITICAL_DURATION` flag, `Manual Verification Required`.
    *   *Rationale:* Prevents antimicrobial resistance or incorrect treatment lengths.

7.  **Low OCR Quality (P0)**
    *   *Input:* Perfect medicine data but `ocrQuality: "low"` in metadata.
    *   *Expected Output:* `LOW_OCR_QUALITY` flag, `Manual Verification Required`.
    *   *Rationale:* Fails safe when source text is untrustworthy.

8.  **Failed AI Validation (P0)**
    *   *Input:* Perfect medicine data but `aiValidationFailed: true` in metadata.
    *   *Expected Output:* `FAILED_VALIDATION` flag, `Manual Verification Required`.
    *   *Rationale:* Fails safe if the LLM output was unstable/salvaged.

9.  **Unknown Medicine (P1)**
    *   *Input:* Uncataloged medicine name.
    *   *Expected Output:* `UNKNOWN_MEDICINE` flag, score reduction. Should not force manual verification if score remains >= 60 and no critical flags.
    *   *Rationale:* Graceful degradation for obscure drugs.

10. **Missing Duration Warning (P1)**
    *   *Input:* Non-critical medicine missing duration.
    *   *Expected Output:* `MISSING_DURATION_WARNING` flag, score reduction.
    *   *Rationale:* Highlights missing context without blocking.

11. **Score Boundary: Review Recommended**
    *   *Input:* Valid medicine, missing timing, medium OCR quality. Score calculated between 60 and 84.
    *   *Expected Output:* `Review Recommended`, `verificationRequired: false`.
    *   *Rationale:* Verifies intermediate boundary condition.

12. **Score Boundary: Manual Verification (Score < 60)**
    *   *Input:* Unknown medicine, missing timing, medium OCR quality. Score calculated < 60.
    *   *Expected Output:* `Manual Verification Required`, `verificationRequired: true`.
    *   *Rationale:* Verifies base score failure condition even without explicit critical flags.

## Part 2 — Prescription API Integration Testing Roadmap

### Goal
Provide end-to-end integration tests for `POST /api/v2/prescriptions/process`.

### Priorities
1.  **Valid Edge OCR Path (P0)**: Image + valid `extractedText` + `ocrMetadata`.
2.  **Valid Server OCR Path (Fallback) (P0)**: Image + NO `extractedText`.
3.  **Missing Image (P1)**: Reject request without a valid image.
4.  **Unsupported Image Type (P1)**: Reject PDF/DOC.
5.  **Corrupted/Malformed ocrMetadata (P1)**: Ensure server recovers or rejects gracefully without crashing.
6.  **AI Partial Recovery Scenario (P2)**: Mock LLM response with one valid and one garbage medicine.
7.  **Empty AI Response (P2)**: Mock LLM returning no medicines.

## Part 3 — ML Kit Retry and Fallback Validation

### Goal
Ensure Frontend `PrescriptionHubScreen` handles OCR edge cases securely.

### Test Scenarios
1.  **OCR Success**: `extractedText` successfully populated and sent to API. Analytics `edge_ocr_success` triggered.
2.  **OCR Failure (ML Kit throws error)**: UI shows retry/fallback option.
3.  **Empty OCR Text (ML Kit returns blank)**: UI shows retry/fallback option. Analytics `edge_ocr_failed` triggered.
4.  **Network Timeout on API Call**: UI shows error, allows manual entry or retry.
5.  **User selects "Fallback to Server OCR"**: Verify API payload excludes `extractedText` to trigger backend vision.

## Part 4 — Zod Schema Protection

### Goal
Prevent silent data loss during edge-to-backend requests.

### Test Scenarios
1.  **uploadPrescriptionBodySchema**: Ensure it explicitly defines and passes through `extractedText`, `ocrMetadata`, and `segmentation`.
2.  **medGemmaResponseSchema**: Ensure unexpected fields are stripped, but required fields remain.

## Part 5 — Partial Recovery Validation

### Goal
Verify `medgemma.validation.ts` logic.

### Test Scenarios
1.  **Mixed Quality JSON**: Array containing `{valid_medicine}`, `{null}`, and `{garbage_keys}`. Assert `{valid_medicine}` survives.
2.  **Malformed JSON Recovery**: String containing markdown blocks around JSON or trailing commas. Assert JSON is cleaned and parsed.
3.  **Completely Invalid Output**: Assert appropriate fallback to empty list and `aiValidationFailed` flag.

## Part 6 — Analytics and Observability Checklist

- [ ] Verify `edge_ocr_success` is dispatched on ML Kit success.
- [ ] Verify `edge_ocr_failed` is dispatched on ML Kit failure/empty result.
- [ ] Ensure backend logs API failure reasons (e.g., "OCR_FAILED", "PARSE_FAILED").

## Part 7 — Prioritization

| Priority | Finding | Risk | Engineering Effort | Beta Blocker? |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | **Confidence Engine Unit Tests** | Clinical safety overrides untested. High risk of false approvals. | 1 Day | Yes |
| **P0** | **ML Kit Frontend Retry Integration Tests** | Silent failures on mobile client. | 1.5 Days | Yes |
| **P1** | **Prescription API Integration Tests** | Core API logic untested. High risk of regression. | 2 Days | Yes |
| **P2** | **AI Validation & Schema Tests** | Partial recovery logic and schema passthrough untested. | 1 Day | No |

## Execution Order
1.  Implement Confidence Engine unit tests (Backend).
2.  Implement Zod Schema protection and AI Validation tests (Backend).
3.  Implement Prescription API integration tests (Backend).
4.  Implement ML Kit Frontend Integration Tests (Frontend).
