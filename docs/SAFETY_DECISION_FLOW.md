# Renomedy Safety Layer: Beta Upgrade (Clinical Risk Matrix)

This document outlines the upgraded safety layer design for the `ConfidenceEngine`.

## Core Philosophy
The safety layer must optimize for **high precision** over high recall. It reduces uncertainty rather than blindly maximizing flags.
Over-flagging leads to alert fatigue and trust breakdown; under-flagging leads to risk exposure.

## Safety Decision Flow (P0 vs P1)

### 🔴 P0 - Manual Review REQUIRED
These flags override any high confidence score and **force** the system into a "Manual Verification Required" state.

1.  **MISSING_CRITICAL_DURATION**
    *   **Trigger**: A medicine is prescribed without duration (`for 5 days`, `1 month`), AND the medicine belongs to `HIGH_RISK_DURATION_CATEGORIES` (e.g., antibiotics, steroids, controlled psychiatric meds).
    *   **Reasoning**: Prevents silent misuse (e.g., taking short-term antibiotics indefinitely).
2.  **CRITICAL_MONITORED_MEDICINE**
    *   **Trigger**: The medicine matches `CRITICAL_MONITORED_MEDS` (e.g., insulin, anticoagulants like warfarin, chemotherapy meds like methotrexate).
    *   **Reasoning**: These drugs have narrow therapeutic indices and require absolute certainty in dosage and instructions.
3.  **Core Trust Failures**
    *   `MISSING_DOSAGE`: Strength/dosage cannot be extracted.
    *   `LOW_OCR_QUALITY`: Input image is severely degraded.
    *   `FAILED_VALIDATION`: The AI model failed schema validation or hallucinated fields.
    *   `SUSPICIOUS_MEDICATION_PATTERN`: The engine detects multiple conflicting records for the same medication (e.g., conflicting strengths or frequencies).
    *   `DUPLICATE_MEDICATION_DETECTED`: The exact same medication appears 3+ times in one scan.

### 🟠 P1 - Warning / Review Recommended
These flags lower the confidence score or provide warnings, but do **not** automatically force a manual review block if the rest of the extraction is perfect.

1.  **MISSING_DURATION_WARNING**
    *   **Trigger**: Duration is missing, but the medicine is a standard, lower-risk chronic medication (e.g., standard hypertension meds).
2.  **HIGH_ATTENTION_MEDICINE**
    *   **Trigger**: Medicine matches `HIGH_ATTENTION_MEDS` (e.g., antibiotics, steroids). While important, they do not inherently force a manual review unless they are missing critical fields (like duration, which elevates to P0).
3.  **UNCERTAIN_DOSAGE_PATTERN**
    *   **Trigger**: The dosage string exists, but the medicine is unknown (not in catalog), and the dosage does not follow standard simple numeric/unit patterns (e.g., `mg`, `ml`).
    *   **Reasoning**: Avoids hard threshold blocking (e.g., `> 4 pills`) which falsely blocks valid instructions like `1-2 tabs SOS`.
4.  **AMBIGUOUS_TIMING**
    *   **Trigger**: The timing/frequency instructions are missing or unclear.

## System Behavior

```text
[OCR Extraction] -> [Confidence Engine]
       |
       v
Check P0 Rules (Missing Critical Duration, Critical Meds, Missing Dosage, etc)
       |
       +--> IF ANY P0 FLAG MATCHES --> OVERRIDE: Set Level = "Manual Verification Required"
       |
       v
Calculate Score (Base score + Penalties for P1 flags)
       |
       +--> IF SCORE >= 85 --> Set Level = "High Confidence"
       +--> IF SCORE < 85  --> Set Level = "Review Recommended"
```