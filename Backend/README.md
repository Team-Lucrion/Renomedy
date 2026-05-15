# Renomedy Backend

Renomedy ships with a single canonical prescription OCR pipeline in Express:

- `src/services/ocr/vision-gemini-ocr.provider.ts` — **Google Cloud Vision** (REST `images:annotate`: `DOCUMENT_TEXT_DETECTION`, then `TEXT_DETECTION` fallback) for OCR text, then **Google Gemini** for structured medicine JSON (same schema and post-processing as the previous in-process Gemini path).
- `src/services/ocr/google-vision-text.ts` — Vision REST calls and OAuth via `google-auth-library` (cached `GoogleAuth` client).
- `src/services/ocr/gemini-prescription-parse.ts` — shared Gemini prompt, JSON extraction, medicine normalization, and card payload building (used by golden tests).
- `main.py` remains as an optional **legacy** FastAPI service (Tesseract + Groq). It is **not** used when `OCR_PROVIDER=vision_gemini`.

## Prescription pipeline

1. React Native uploads the prescription image to the Renomedy API.
2. The Express prescription module stores the image in Supabase.
3. `VisionGeminiOcrProvider` calls Google Vision on the image bytes and normalizes OCR text.
4. Gemini parses that text into the Renomedy medicine JSON schema.
5. Express saves `raw_ocr_text`, `cleaned_ocr_text`, `parsed_medicine_json`, `prescription_medications`, and Gemini metadata on `prescriptions`.

## Environment

Add these variables to `Backend/.env` for production scanning:

- `OCR_PROVIDER=vision_gemini` (default) or `OCR_PROVIDER=mock` for automated tests / demos without cloud credentials
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (default `gemini-2.0-flash`)
- **One** of:
  - `GOOGLE_APPLICATION_CREDENTIALS` — path to a GCP service account JSON with Vision API enabled, or
  - `GOOGLE_VISION_SERVICE_ACCOUNT_JSON` — inline JSON for the same key (useful on some hosts)

Also required for the rest of the API: `SUPABASE_*`, `CLERK_*`, etc. (see `.env.example`).

Optional (legacy FastAPI only): `GROQ_API_KEY`, `OCR_API_URL`, `TESSERACT_CMD`, `FASTAPI_ALLOWED_ORIGINS`.

## Local run

1. `npm --prefix Backend install`
2. `npm --prefix Backend run dev`

## Tests

- `npm --prefix Backend test` — builds TypeScript then runs `node --test` (includes golden parser fixtures under `tests/fixtures/golden/`).

## Supabase fields used by the pipeline

- `prescription_uploads` — storage metadata
- `prescriptions.raw_ocr_text`, `cleaned_ocr_text`, `parsed_medicine_json`, `parse_status`, `ocr_provider`, `ocr_provider_metadata`
- `prescriptions.ai_provider`, `ai_model`, `ai_raw_response` — Gemini metadata
- `prescription_medications` — normalized rows for UI and continuity

## Safety

- OCR and model output are advisory; users verify or correct before save.
- Parser instructions discourage hallucinated medicines and low-confidence handling maps to manual verification flags.
