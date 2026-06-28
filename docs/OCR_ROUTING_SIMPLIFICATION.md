# OCR + AI Routing Simplification for Beta

## Before → After Architecture Comparison

### Before (Multi-Path Hybrid Routing)
- **OCR Providers**: `VisionGeminiOcrProvider`, `TesseractGroqOcrProvider`, `DirectGeminiOcrProvider`, `MlKitMedGemmaProvider`.
- **AI Structuring**: `GeminiAiProvider`, `MedGemmaAiProvider`.
- **Execution Flow**: The `createOcrProvider()` factory evaluated the `OCR_PROVIDER` config. If an API key was present, it dynamically instantiated a `FallbackOcrProvider` wrapping `VisionGemini` and `DirectGemini`, adding significant latency and runtime complexity to gracefully fail over between different provider types.
- **Merge Logic**: The system attempted complex fallback logic to retry completely different architectures if the primary failed or returned zero medications.

### After (Single-Path Edge-First Routing)
- **Primary OCR Path**: Edge OCR (Client-side ML Kit).
- **Primary AI Structuring Path**: `MedGemma 1.5` (via `MlKitMedGemmaProvider` and `MedGemmaAiProvider`).
- **Fallback OCR**: Server-side Google Cloud Vision (`VisionGeminiOcrProvider`), used strictly via environment configuration fallback or explicit lack of client-side text extraction, NOT via dynamic parallel retry.
- **Execution Flow**: The OCR Factory resolves strictly to ONE provider determined at runtime via `env.OCR_PROVIDER`. Complex try/catch wrapper logic has been removed.

## List of Removed Routing Logic
1.  **Deleted `FallbackOcrProvider`**: The entire class responsible for executing a secondary OCR provider dynamically on failure has been removed.
2.  **Removed Dynamic Fallback Factory Logic**: `ocr-provider.factory.ts` no longer instantiates `FallbackOcrProvider`.
3.  **Removed Hybrid AI Provider Merging**: `ai-provider.factory.ts` logic has been streamlined.

## New Simplified Execution Flow
1.  Frontend scans document using ML Kit (Edge OCR).
2.  Frontend passes `extractedText` to Backend.
3.  Backend `OcrProviderFactory` strictly loads `MlKitMedGemmaProvider` (or the configured standard).
4.  If `extractedText` exists, structure immediately using MedGemma.
5.  If `extractedText` does NOT exist, rely entirely on the simple internal fallback within `MlKitMedGemmaProvider` (VisionGemini) or fail fast.

## Risks Introduced + Why They Are Acceptable for Beta
- **Risk**: *Lower Resiliency on Edge Cases.* If the primary OCR path fails completely, the backend will no longer silently attempt an entirely different OCR engine (like Tesseract or DirectGemini) to salvage the scan.
- **Acceptability**: For a 100-family beta, **observability is more important than silent salvation**. By failing fast, we generate clear analytics events (`edge_ocr_failed`) which highlight UX/camera issues rather than masking them with slow, expensive secondary API calls. This drastically simplifies debugging and stabilizes latency.
