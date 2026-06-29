# Renomedy OCR Architecture Review

## 1. Architecture Assessment

The Renomedy OCR pipeline utilizes a modern, edge-first architecture prioritizing low latency and clinical safety. The pipeline transitions from a legacy multi-path fallback strategy to a streamlined single-path routing mechanism.

**Stages and Flow:**
1. **Input Acquisition (Frontend)**: React Native Expo app captures images using ML Kit Document Scanner for edge text extraction.
2. **Routing (Backend)**: Requests containing either raw images or `extractedText` hit the `OcrProviderFactory`.
3. **Text Extraction**: Primary extraction is client-side (`MlKitMedGemmaProvider`). If edge extraction fails or is unsupported, it falls back to server-side Google Cloud Vision.
4. **Clinical Structuring**: The extracted text is structured into a JSON schema representing medications using a simulated MedGemma 1.5 model.
5. **Trust Layer & Validation**: A centralized `ConfidenceEngine` evaluates the structured JSON against a clinical matrix (catalog matching, safety rules, dosage/frequency presence, contextual duplicates).
6. **Result Generation**: Verified outputs, augmented with confidence scores and Risk Flags, are persisted to Supabase and presented to the user for manual review.

**Strengths:**
- **Edge-First Design**: Offloading OCR to the client significantly reduces backend load and server-side processing latency.
- **Robust Trust Layer**: The `ConfidenceEngine` correctly prioritizes patient safety by defaulting to "Manual Verification Required" upon encountering any critical ambiguity or risk flags.
- **Clean Decoupling**: Separation of raw text extraction from AI medical reasoning allows independent scaling and upgrading of either component.

**Failure Points & Risks:**
- **Reliability**: Variability in mobile device camera quality may cause poor edge extraction, resulting in heavy reliance on the slower server-side Cloud Vision fallback.
- **Scalability**: The current `medicineIntelligence.ts` relies on in-memory CSV parsing (`swasthi_beta_intelligence_v2.csv`), which will consume excessive memory and increase startup latency as the medication catalog grows. The reminder generation using `node-cron` cannot scale horizontally across multiple backend instances.
- **Incorrect Data Propagation**: While the `ConfidenceEngine` provides robust safety checks, complete failures during AI reasoning (e.g., LLM 500 errors or malformed JSON) could lead to unhandled exceptions rather than graceful fallbacks to manual entry.

## 2. Critical Issues Ranked by Severity

*   **P0 (Critical Beta Blocker): Unhandled AI Processing Exceptions**
    *   **Description**: Complete JSON schema failure or unhandled 500 errors from the MedGemma/Gemini API currently risk causing silent failures or crashing the request context instead of triggering a graceful manual fallback in the UI.
    *   **Impact**: Patients might be left on loading screens or face generic errors, preventing them from uploading prescriptions.
*   **P1 (High Risk): Simulated MedGemma Deployment**
    *   **Description**: The system relies on `gemini-2.0-flash` to simulate MedGemma 1.5. While cost-effective, it lacks the specialized clinical fine-tuning of the actual MedGemma model.
    *   **Impact**: Higher likelihood of clinical hallucinations or misinterpretations of medical abbreviations.
*   **P1 (High Risk): Frontend Error Boundaries for OCR Timeouts**
    *   **Description**: Network failure states currently rely on generic errors in `PrescriptionHubScreen`.
    *   **Impact**: If the backend OCR times out (e.g., during Cloud Vision fallback), users are not explicitly guided to manual data entry.
*   **P2 (Medium Risk): Missing Duration Risk Flag**
    *   **Description**: The `ConfidenceEngine` lacks a specific risk flag for missing duration validation.
    *   **Impact**: Decreased adherence and safety risks, especially for critical medications like antibiotics where duration is essential.
*   **P2 (Medium Risk): Scalability of In-Memory Catalog**
    *   **Description**: The medicine catalog is loaded into memory via CSV parsing.
    *   **Impact**: Will become a memory bottleneck as the dataset scales beyond the beta phase.

## 3. Recommended Improvements

1.  **Enhance Error Handling**: Implement strict error boundaries around the LLM invocation in `MlKitMedGemmaProvider`. If extraction fails, return a defined error payload that the frontend uses to display a clear "OCR Failed: Please enter manually" UI.
2.  **Database-Backed Catalog**: Migrate the in-memory CSV catalog (`swasthi_beta_intelligence_v2.csv`) to an indexed Supabase table and query it using RPC or standard queries to reduce memory overhead.
3.  **Refine Confidence Engine**: Add a "MISSING_DURATION" risk flag specifically to evaluate adherence risks for antibiotics and other time-sensitive treatments.

## 4. Beta Blockers

*   **P0: Unhandled LLM / Schema validation errors** must be wrapped in a graceful fallback mechanism to ensure the user can manually enter prescription details without the app hanging.
*   **P1: Frontend explicit fallback UI** must be implemented to handle backend timeouts smoothly.

## 5. Future ML Kit Integration Considerations

*   **Device Fragmentation**: As ML Kit is deployed across a wider range of Android devices, performance and accuracy will vary. Continuous analytics monitoring (`edge_ocr_success` vs `edge_ocr_failed`) is crucial to determine if certain device models should default to server-side OCR.
*   **Multimodal Edge AI**: Future iterations should consider running small, specialized medical LLMs directly on-device alongside ML Kit, further reducing backend reliance and enhancing privacy.
*   **Context Preservation**: Ensure that ML Kit bounding boxes and spatial data can be passed alongside raw text to the MedGemma model to preserve layout context, which is often lost in flat text extraction.

## 6. Cross-Team Dependencies

*   **Frontend Team**: Needs to implement explicit error boundaries and fallback UIs for OCR timeouts and failures in `PrescriptionHubScreen`.
*   **Backend / AI Team**: Needs to swap the `gemini-2.0-flash` simulation with the true MedGemma 1.5 endpoint once deployed. Requires implementation of robust exception handling for AI provider failures.
*   **Data / DB Team**: Needs to orchestrate the migration of the CSV medicine catalog to Supabase.
*   **Security Team**: Verify that `extractedText` payloads do not introduce injection vulnerabilities when passed to the backend AI layer.
