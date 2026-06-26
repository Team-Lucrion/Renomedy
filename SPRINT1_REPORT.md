# Renomedy Sprint 1 Report: Edge OCR Modernization

## 1. Summary of Changes
Sprint 1 has successfully transitioned the Renomedy prescription capture pipeline to an **Edge-First architecture**. OCR processing now happens on the mobile device whenever possible, which reduces latency and backend costs. The system maintains a robust fallback to Google Cloud Vision for unsupported environments or failed edge extractions.

### Key Achievements
- **On-Device OCR:** Integrated ML Kit Text Recognition v2 for real-time extraction.
- **Document Scanning:** Integrated ML Kit Document Scanner for perspective correction and cropping.
- **Quality Gate:** Implemented `ImageQualityService` to validate image clarity before processing.
- **Hybrid Backend:** Updated OCR providers and services to support both raw image uploads and pre-extracted text strings.
- **Documentation:** Provided a full `ARCHITECTURE_AUDIT.md` and `MODERNIZATION_DESIGN.md`.

## 2. Files Modified

### Backend
- `Backend/src/services/ocr/ocr-provider.ts`: Interface update for edge text support.
- `Backend/src/services/ocr/vision-gemini-ocr.provider.ts`: Logic to bypass backend OCR.
- `Backend/src/services/ocr/tesseract-groq-ocr.provider.ts`: Support for edge text and bug fix for variable scope.
- `Backend/src/services/ocr/direct-gemini-ocr.provider.ts`: Text-based clinical reasoning mode.
- `Backend/src/services/ocr/fallback-ocr.provider.ts` & `mock-ocr.provider.ts`: Compatibility updates.
- `Backend/src/modules/prescriptions/prescriptions.schemas.ts`: Updated validation for edge fields.
- `Backend/src/modules/prescriptions/prescriptions.routes.ts`: Metadata JSON parsing logic.
- `Backend/src/modules/prescriptions/prescriptions.controller.ts`: Metadata JSON parsing logic.
- `Backend/src/modules/prescriptions/prescriptions.service.ts`: Orchestration of the hybrid pipeline.

### Frontend
- `Frontend/package.json`: Added ML Kit and Document Scanner dependencies.
- `Frontend/src/lib/api.ts`: Refactored `scanPrescription` to transmit edge data.
- `Frontend/src/screens/PrescriptionHubScreen.tsx`: Updated capture workflow.
- `Frontend/src/lib/ocr/ImageQualityService.ts` (New)
- `Frontend/src/lib/ocr/MlKitScannerService.ts` (New)
- `Frontend/src/lib/ocr/MlKitTextRecognitionService.ts` (New)

## 3. New Dependencies
- `@react-native-ml-kit/text-recognition`: ^1.2.0
- `react-native-document-scanner-plugin`: ^1.1.2

## 4. Manual Setup Required
1. **Dependency Sync:** Run `npm install` in the `Frontend` directory.
2. **Development Client:** A new build of the development client is required to link the native ML Kit and Document Scanner libraries (`npx expo run:ios` or `android`).
3. **Physical Device:** Real-time edge OCR requires a physical device. Simulators will automatically fallback to backend-based OCR.

## 5. Known Limitations
- **Image Quality Checks:** Currently uses a simulated logic placeholder; real native-level blur/brightness metrics are scheduled for future iteration.
- **Expo Go:** This sprint introduces native modules not supported in standard Expo Go; a development client is mandatory.
