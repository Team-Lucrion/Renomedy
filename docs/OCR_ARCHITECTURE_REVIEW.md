# OCR Architecture Review & Modernization Roadmap

## 1. Current OCR Architecture Diagram

```text
[Mobile App (Frontend)]
       |
       | (Image Capture/Upload)
       v
[Backend API]
       |
       v
[OcrProviderFactory] ---> (Selects active provider based on OCR_PROVIDER env)
       |
       +---> VisionGeminiOcrProvider (Production Standard)
       |       |--> Step 1: Google Cloud Vision (Text Extraction)
       |       |--> Step 2: Google Gemini (Structuring/Reasoning)
       |
       +---> TesseractGroqOcrProvider (Fallback)
       |       |--> Step 1: Tesseract (Server OCR)
       |       |--> Step 2: Groq LLM (Structuring)
       |
       +---> DirectGeminiOcrProvider (Experimental Multimodal)
       |       |--> Single Step: Gemini 1.5 Pro Multimodal
       |
       +---> MlKitMedGemmaProvider (Modernization Target)
               |--> Step 1: ML Kit Document Scanner (Edge OCR)
               |--> Step 2: MedGemma 1.5 (Local/Specialized Structuring)
       |
       v
[Parsed Data (OcrParseResult)] ---> DB Storage (Supabase) ---> [Frontend UI]
```

## 2. OCR Bottleneck & Prescription Reliability Report

### Prescription Reliability Risks (Highest Priority)
- **Degradation Points**: The primary degradation occurs during image capture (blur, poor lighting) and network transmission (compression loss). Server-side OCR amplifies latency and drops contextual layout information if not handled carefully before LLM structuring.
- **Handwritten Challenges**: Doctors' cursive handwriting is notoriously difficult. Standard generalized OCRs (like Google Cloud Vision) fail on heavily cursive or shorthand notations (e.g., "BD", "OD") without deep medical dictionaries, leading to hallucinated text.
- **Scan Quality Dependencies**: High reliance on the camera quality of the user's device. Without edge-level guidance (e.g., bounding boxes, lighting checks), users frequently submit unreadable images.
- **Failure Modes Impacting Patients**: Incorrectly parsed dosages (e.g., parsing 10mg as 100mg) or dropped warnings directly impact patient safety and understanding.

### Top Bottlenecks
1. **Server-Side Latency**: Round-trip time to upload images, process through Cloud Vision, and then route to Gemini adds significant delay.
2. **Coupled OCR & Reasoning**: Some providers (like DirectGemini) combine OCR and clinical reasoning, making it difficult to debug where an error occurred (extraction vs. hallucination).
3. **Bandwidth Limitations**: Sending high-res images over cellular networks is slow and unreliable.

## 3. ML Kit Integration Plan

### Migration Readiness
- **Current Workflow**: Image Capture -> Upload to Backend -> Server-side OCR -> LLM Structuring -> Return JSON.
- **Future Workflow (ML Kit)**: Edge Image Capture (ML Kit Document Scanner) -> Edge Text Extraction -> Upload Text (JSON) to Backend -> MedGemma Structuring -> Return JSON.

### Evaluation
- **Replaced**: Server-side OCR processing for supported devices.
- **Retained**: Backend clinical reasoning (LLM structuring), Fallback logic (for older devices).
- **Enhanced**: Scan quality (ML Kit provides on-device UI for cropping and enhancement).
- **Complexity**: High (Frontend changes required to integrate React Native ML Kit and handle fallback logic).
- **Risk**: Medium. Mitigated by maintaining `VisionGeminiOcrProvider` as a fallback.

## 4. MedGemma Integration Opportunities

### Readiness and Architecture
- **Value Proposition**: MedGemma provides clinical reasoning specialized for healthcare, outperforming generalized LLMs in understanding shorthand, dosing intervals, and medicine names.
- **Separation of Concerns**: The architecture strictly decouples extraction (OCR) from understanding (MedGemma). The `MlKitMedGemmaProvider` takes `extractedText` as metadata, skipping server-side image processing, and routes the text to the AI reasoning engine.
- **Recommendation**: Maintain the `OcrProvider` interface but expand its metadata support to cleanly pass `extractedText` from the frontend, ensuring the backend acts as a pure reasoning and persistence layer.

## 5. Healthcare-Specific Risk Assessment

- **Incorrect Medicine Names**: Potential for fatal errors. **Mitigation**: Confidence scoring and cross-referencing against the Indian Medicines catalog.
- **Incorrect Dosage Extraction**: Similar visual characters (1 vs 7, mg vs mcg). **Mitigation**: Strict Zod validation and MedGemma prompt hardening.
- **Missing Prescription Information**: Truncated scans. **Mitigation**: ML Kit Document Scanner edge guidance.
- **Ambiguous Handwriting**: **Mitigation**: Prompt engineering to force "requiresManualVerification: true" when confidence is low.
- **False Confidence**: AI systems being overly confident. **Mitigation**: Confidence Engine (Auto Accept, Review, Manual Verification) based on multi-signal matching.

## 6. Implementation Roadmap (Scalability & Maintainability)

- **Provider Abstractions**: The current `OcrProviderFactory` is robust but relies on environment variables for routing. This should be made dynamic per-request (e.g., based on client capabilities).
- **Interface Technical Debt**: `OcrParseResult` and `OcrProvider` currently assume an `imageBuffer` is always the primary payload. This must be refactored to allow `metadata.extractedText` to bypass buffer processing entirely.
- **Decoupling**: Ensure AI providers (Gemini vs. MedGemma) have their own abstract factory distinct from OCR extraction.

## 7. Recommended Next Sprint Tasks

### Sprint 1: Critical Reliability Fixes
- Harden existing Zod schemas for backend parsing.
- Introduce `extractedText` passthrough in API schemas (e.g., `uploadPrescriptionBodySchema`) to prevent data loss.
- Review and refine fallback mechanisms for `FallbackOcrProvider`.

### Sprint 2: ML Kit Integration
- Integrate `@react-native-ml-kit/text-recognition` and `react-native-document-scanner-plugin` on the Frontend.
- Modify Frontend API calls to pass `extractedText` to the backend.

### Sprint 3: OCR Quality Improvements
- Implement on-device UI feedback for scan quality (lighting, blur).
- Refine backend OCR metadata logging for observability.

### Sprint 4: MedGemma Integration Preparation
- Deploy MedGemma reasoning prompts (centralized in `prompts.ts`).
- Stand up `MlKitMedGemmaProvider` and route traffic based on frontend payload flags.

### Sprint 5: Advanced Intelligence & Optimization
- Integrate the Confidence Engine (`confidenceEngine.ts`) with MedGemma outputs.
- Align output structure with initial FHIR compatibility goals.

## 8. Cross-Team Dependencies

- **Frontend & UX**:
  - Implementation of ML Kit Document Scanner UI.
  - Displaying OCR confidence indicators and manual verification flows.
- **Backend & Data Systems**:
  - Validating and persisting edge-extracted text vs server-extracted text.
  - Ensuring database schemas support new confidence metrics.
- **Product/UX**:
  - Defining the user journey for failed edge scans (fallback to server OCR).
  - Clarifying the review UI for "Manual Verification" required results.
- **Landing Page Strategy**:
  - Highlighting "On-Device Privacy" and "Lightning Fast Edge OCR" enabled by the ML Kit migration.

## 9. Conclusion

1. **Current Architecture Score**: 75/100 (Stable, but high latency and coupled logic in experimental paths)
2. **ML Kit Readiness Score**: 85/100 (Backend abstractions are prepared; frontend requires heavy lifting)
3. **MedGemma Readiness Score**: 90/100 (Prompts and factory patterns are already established)
4. **Top 5 Bottlenecks**:
   - Server-side image upload latency.
   - Coupling of Vision and LLM in fallback paths.
   - Inconsistent handwritten text resolution on generalized models.
   - Lack of edge-based scan quality enforcement.
   - API schema strictness stripping passthrough metadata.
5. **Top 5 Quick Wins**:
   - Add `extractedText` to Zod upload schemas.
   - Enable Edge ML Kit for modern Android devices.
   - Route known bad handwriting to MedGemma over generic Gemini.
   - Implement the `requiresManualVerification` flag in UI.
   - Separate AI Provider Factory from OCR Provider Factory.
6. **Recommended Architecture Roadmap**:
   Transition to an Edge-First, Healthcare-Specialized pipeline where the Mobile Client handles image acquisition and text extraction (ML Kit), and the Backend acts as a clinical reasoning layer (MedGemma) providing structured, FHIR-ready JSON.
