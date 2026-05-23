# Renomedy Backend

Renomedy now supports two prescription OCR pipelines in Express:

- `src/services/ocr/vision-gemini-ocr.provider.ts` for Google Vision plus Gemini
- `src/services/ocr/tesseract-groq-ocr.provider.ts` for the PrescriptoAI-style Tesseract.js plus Groq flow
- `src/services/ocr/direct-gemini-ocr.provider.ts` as a Gemini Vision fallback when `GEMINI_API_KEY` is available
- `src/services/ocr/groq-prescription-parse.ts` for strict Groq JSON parsing and normalization

## Prescription pipeline

1. React Native uploads the prescription image to the Renomedy API.
2. The Express prescription module stores the image in Supabase.
3. The configured OCR provider reads the image bytes and normalizes OCR text.
4. The configured AI parser converts OCR text into structured medicine JSON.
5. Express saves `raw_ocr_text`, `cleaned_ocr_text`, `parsed_medicine_json`, `prescription_medications`, and provider metadata on `prescriptions`.

## Environment

Copy [Backend/.env.example](/C:/Users/Manjunath/Desktop/Rajath/Development/Renomedy/Backend/.env.example) to `Backend/.env`.

For the PrescriptoAI-style backend API, set:

- `OCR_PROVIDER=prescripto_ai` or `OCR_PROVIDER=tesseract_groq`
- `GROQ_API_KEY`
- `GROQ_MODEL=llama-3.3-70b-versatile`
- `MAX_UPLOAD_MB=10`

To keep Gemini as fallback, also set:

- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-2.0-flash`

For the older Google Vision pipeline, set:

- `OCR_PROVIDER=vision_gemini` or `OCR_PROVIDER=mock`
- one of `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_VISION_SERVICE_ACCOUNT_JSON`

Also required for the rest of the API: `SUPABASE_*`, `CLERK_*`, and the other variables in `.env.example`.

## Local run

1. `npm --prefix Backend install`
2. `npm --prefix Backend run dev`

## Scan endpoint

Use `POST /api/scan-prescription` with:

- `Authorization: Bearer <clerk-jwt>`
- `multipart/form-data`
- `family_member_id=<uuid>`
- `file=<image>` or `image=<image>`

The same route also accepts JSON with `family_member_id` plus `imageBase64` or `imageUrl`. API keys stay server-side in `Backend/.env`.

Response shape:

```json
{
  "success": true,
  "provider": "prescripto_ai",
  "rawText": "original OCR text here",
  "cleanedText": "cleaned OCR text here",
  "confidence": 0.82,
  "medicines": [
    {
      "name": "Telma",
      "strength": "40mg",
      "dose": "1 tablet",
      "frequency": "OD",
      "frequencyMeaning": "once daily",
      "foodTiming": "after food",
      "durationDays": 30,
      "instructions": "Take once daily after food",
      "confidence": 0.84,
      "needsReview": true
    }
  ],
  "warnings": [],
  "status": "pending_verification"
}
```

The endpoint also returns `prescriptionId` and `prescription` so the app can keep using the existing verification UI and editing flow.

## Test the endpoint

PowerShell example:

```powershell
.\scripts\test-scan-prescription.ps1 `
  -FilePath "C:\path\to\prescription.jpg" `
  -FamilyMemberId "<family-member-uuid>" `
  -BearerToken "<clerk-jwt>" `
  -ApiBaseUrl "http://localhost:4000"
```

The mobile app now calls `/api/scan-prescription` through `scanPrescription(imageUri, familyMemberId)` in [Frontend/src/lib/api.ts](/C:/Users/Manjunath/Desktop/Rajath/Development/Renomedy/Frontend/src/lib/api.ts).

## Tests

- `npm --prefix Backend test`
- `npm --prefix Backend run typecheck`

## Supabase fields used by the pipeline

- `prescription_uploads` for storage metadata
- `prescriptions.raw_ocr_text`, `cleaned_ocr_text`, `parsed_medicine_json`, `parse_status`, `ocr_provider`, `ocr_provider_metadata`
- `prescriptions.ai_provider`, `ai_model`, `ai_raw_response`
- `prescription_medications` for normalized rows used by the UI and activation flow

## Safety

- OCR is only an interpretation layer.
- Swasthi interprets - you decide.
- Users must verify every medicine before activation.
- Low-confidence fields are marked for review.
- The parser does not diagnose, recommend dosage changes, or suggest brand substitutions.
