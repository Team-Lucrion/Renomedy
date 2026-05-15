# Renomedy

Renomedy is split into two applications inside one workspace:

- `Frontend/` contains the Expo React Native app.
- `Backend/` contains the Express API and the canonical prescription pipeline: **Google Cloud Vision** for OCR text extraction and **Google Gemini** for structured medicine parsing (`OCR_PROVIDER=vision_gemini`).

## Integrated local setup

1. Install dependencies in both apps:
   - `npm --prefix Backend install`
   - `npm --prefix Frontend install`
2. Create env files:
   - `Copy-Item Backend/.env.example Backend/.env`
   - `Copy-Item Frontend/.env.example Frontend/.env`
3. Update the backend env with your Supabase, Clerk, and service credentials.
4. Point the frontend env at the backend:
   - local web: `EXPO_PUBLIC_API_BASE_URL=http://localhost:4000`
   - Android emulator: `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4000`
5. Start both apps from the repo root:
   - `npm run dev:backend`
   - `npm run dev:frontend`

## Shared commands

- `npm run typecheck`
- `npm run typecheck:backend`
- `npm run typecheck:frontend`

## Integration contract

- Frontend authentication is handled by Clerk Expo.
- Frontend API calls send the Clerk bearer token to the backend.
- Backend validates the token, maps the Clerk user to the local `users` table, and serves family, medication, dashboard, and prescription data.
- Prescription OCR is handled by `Backend/src/services/ocr/vision-gemini-ocr.provider.ts`: **Google Cloud Vision** extracts text; **Gemini** structures medicines. Set `OCR_PROVIDER=mock` only for tests or demos without Vision/Gemini credentials.
- `CORS_ALLOWED_ORIGINS` in `Backend/.env` controls which browser origins may call the API. Native mobile requests without a browser origin remain allowed.
