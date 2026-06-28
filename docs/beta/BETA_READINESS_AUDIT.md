# Beta Readiness Audit: Renomedy

## 1. Beta Readiness Score
**Score: 65 / 100**

## 2. GO / NO-GO Decision
**NO-GO**
*Reasoning:* While the OCR and Safety layers are structurally sound, critical P0 blockers in Privacy Compliance, User Feedback Mechanisms, and missing Safety coverage rules (e.g. `HIGH_RISK_MEDICINE`, `MISSING_DURATION`) prevent a safe healthcare beta deployment.

## 3. P0 Blockers (Must Fix Before Launch)
1. **Privacy Policy UI Acknowledgment (Compliance):** The privacy policy exists as a draft (`docs/legal/PRIVACY_POLICY_DRAFT.md`), but there is no explicit user acknowledgment or acceptance requirement in the UI (e.g., during Onboarding or Login). This is a legal and compliance blocker.
2. **User Feedback System (Compliance & Safety):** There is no in-app feedback or issue reporting mechanism. The only feedback channel is a static text mention of `support@renomedy.com` in `AboutSwasthiScreen.tsx`. A structured feedback loop (especially post-scan and for failure reporting) is required.
3. **Safety Engine Coverage Gaps (Safety):** The `ConfidenceEngine` lacks implementation for `HIGH_RISK_MEDICINE` and `UNSAFE_DOSAGE_PATTERN` (only checks for contradictory frequency/strength, not unsafe absolute values) and `MISSING_DURATION`. These gaps expose users to significant clinical risks without triggering a manual review.
4. **Client-side OCR Fallback Visibility (UX Resilience):** When Edge OCR (ML Kit) fails in `PrescriptionHubScreen.tsx`, it falls back to the server silently, swallowing the error (`edge_ocr_failed` track event). Users are not informed of the fallback, which can cause confusing delays and degrade trust. Both failures failing is also handled generically without explicit direction to Manual Entry.

## 4. P1 Issues (Fix During Beta)
1. **Multi-page Scan Handling:** The current OCR pipeline (both Edge and Backend) expects a single image URI. Multi-page prescription support is absent.
2. **MedGemma Failure Recovery:** `medgemma.validation.ts` catches malformed JSON with best-effort parsing, but if the fallback also fails, it returns an empty state rather than properly propagating an explicit "needs manual entry" error back through the UI pipeline.

## 5. P2 Improvements (Post-Beta)
1. **Model Confidence Calibration:** Integrate ML Kit bounding box probabilities and MedGemma logprobs directly into the `ConfidenceEngine` scoring, rather than relying purely on discrete categorical rules.
2. **Automated Account Deletion:** Transition from manual email-based deletion requests to a fully automated in-app deletion flow.

## 6. System Risk Analysis
- **Clinical Safety Risk (High):** Without robust duration extraction checking and high-risk medicine flagging, AI hallucinations could lead to extended or dangerous dosing.
- **Operational Risk (Medium):** The lack of a structured user feedback loop means beta issues will rely on manual email reports, drastically increasing the time-to-discovery for critical OCR failure modes.
- **Privacy Risk (High):** Releasing without explicit Terms of Service and Privacy Policy consent exposes the organization to legal liabilities in handling sensitive prescription data.

## 7. OCR Pipeline Stability Review
- **Edge OCR (ML Kit):** Fast and privacy-preserving. However, failure handling is silent, leading to opaque fallback latency.
- **Server OCR (Google Vision / Gemini):** Strong fallback, but latency is high.
- **Pipeline integration:** Decoupled effectively via `OcrProviderFactory`. The dual-layer approach is solid, but UX visibility into the pipeline state is poor.
- **Double Failure:** If both Edge and Server OCR fail, the UI degrades to a generic "We could not clearly read this prescription," missing an opportunity to aggressively guide the user to the manual entry fallback flow.

## 8. Safety Engine Audit
- **ConfidenceEngine (`Backend/src/utils/confidenceEngine.ts`):**
  - **Strengths:** Excellent foundational architecture. Effectively aggregates trust signals and applies critical safety overrides (e.g., `MISSING_DOSAGE`, `FAILED_VALIDATION`).
  - **Weaknesses:** Missing required flags for a Beta release: `MISSING_DURATION`, `HIGH_RISK_MEDICINE`. The `SUSPICIOUS_MEDICATION_PATTERN` logic is rudimentary (only checks for contradictions across duplicates, not absolute unsafe dosing).
  - **Over-flagging Risk:** Moderate. The strictness on `MISSING_DOSAGE` may flag many valid, simple prescriptions, but this is an acceptable tradeoff for beta safety.

## 9. Compliance Status (Privacy + Feedback)
- **Privacy Policy:** Draft exists (`docs/legal/PRIVACY_POLICY_DRAFT.md`), but is NOT integrated into the app. **[FAIL]**
- **Terms of Service:** Draft exists, but NOT integrated into the app. **[FAIL]**
- **Feedback Mechanism:** Only a static email address exists in the About screen. No structured post-scan feedback or error reporting UI. **[FAIL]**

## 10. Final Minimal Beta Architecture Summary
The beta architecture relies on a hybrid Edge-First OCR pipeline:
1. **Mobile Client:** Captures image -> ML Kit Edge OCR (Text Extraction).
2. **Backend AI:** Receives Edge Text -> `MlKitMedGemmaProvider` -> MedGemma 1.5 (Structuring/Reasoning via OpenAI-compatible endpoint).
3. **Safety Layer:** `ConfidenceWrapperProvider` & `ConfidenceEngine` evaluate the payload, appending risk flags and enforcing manual verification overrides.
4. **Fallback:** If Edge OCR fails, the client submits the image to the Backend for Google Cloud Vision OCR + Gemini structuring.
5. **Data Persistence:** Supabase stores structured data, which drives the medication tracking and reminder scheduling systems.

*Note: The MedGemma integration is real (via a self-hosted API `MEDGEMMA_ENDPOINT`), not mocked.*
