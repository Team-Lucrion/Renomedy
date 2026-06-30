# Scan Prescription Dependency Graph

Starting point: `decodePrescriptionUpload()` from `Backend/src/modules/prescriptions/prescriptions.service.ts`

```text
Backend/src/modules/prescriptions/prescriptions.service.ts
└── decodePrescriptionUpload()
    ├── Purpose: Master orchestrator for uploading and decoding a prescription image.
    ├── Dependencies: `uploadPrescription`, `parsePrescription`, `getPrescription`
    ├── Database tables touched: None directly (handled by children)
    ├── External APIs touched: None directly (handled by children)
    │
    ├── calls uploadPrescription()
    │   ├── Import path: Local function within `prescriptions.service.ts`
    │   ├── Purpose: Uploads image to Supabase storage, validates user limits, and creates the initial DB records.
    │   ├── Dependencies:
    │   │   ├── `ensureClosedBetaAccess` (from `../../services/beta-access.service`)
    │   │   ├── `assertFeatureAccess` (from `../subscriptions/subscriptions.service`)
    │   │   ├── `getAccessibleFamilyMemberIds` (Local function)
    │   │   ├── `supabaseAdmin` (from `../../lib/supabase`)
    │   │   ├── `writeAuditLog` (from `../../services/audit.service`)
    │   │   ├── `incrementScanUsage` (from `../subscriptions/subscriptions.service`)
    │   │   └── `buildSignedPrescriptionUrl` (Local function)
    │   ├── Database tables touched:
    │   │   ├── `prescriptions` (INSERT)
    │   │   └── `prescription_uploads` (INSERT)
    │   ├── External APIs touched: Supabase Storage Bucket (`upload`)
    │   │
    │   ├── calls ensureClosedBetaAccess()
    │   │   ├── Import path: `Backend/src/services/beta-access.service.ts`
    │   │   ├── Purpose: Validates that the current user has beta access.
    │   │   ├── Dependencies: `getCurrentUserRecord` (from `./current-user.service`)
    │   │   ├── Database tables touched: `users` (SELECT, UPSERT via `ensureCurrentUserExists`)
    │   │   └── External APIs touched: None
    │   │
    │   ├── calls assertFeatureAccess()
    │   │   ├── Import path: `Backend/src/modules/subscriptions/subscriptions.service.ts`
    │   │   ├── Purpose: Validates that the user's subscription allows them to scan a prescription based on quota.
    │   │   ├── Dependencies: `getCurrentUserRecord`, `getActiveSubscriptionForUser`, `getCurrentUsage`
    │   │   ├── Database tables touched: `user_subscriptions` (SELECT), `usage_tracking` (SELECT)
    │   │   └── External APIs touched: None
    │   │
    │   ├── calls getAccessibleFamilyMemberIds()
    │   │   ├── Import path: Local function within `prescriptions.service.ts`
    │   │   ├── Purpose: Fetches the IDs of family members the user is authorized to add a prescription for.
    │   │   ├── Dependencies: `supabaseAdmin`
    │   │   ├── Database tables touched: `family_group_memberships` (SELECT), `family_members` (SELECT)
    │   │   └── External APIs touched: None
    │   │
    │   ├── calls writeAuditLog()
    │   │   ├── Import path: `Backend/src/services/audit.service.ts`
    │   │   ├── Purpose: Logs the upload success/failure action to the database.
    │   │   ├── Dependencies: `supabaseAdmin`
    │   │   ├── Database tables touched: `audit_logs` (INSERT)
    │   │   └── External APIs touched: None
    │   │
    │   └── calls incrementScanUsage()
    │       ├── Import path: `Backend/src/modules/subscriptions/subscriptions.service.ts`
    │       ├── Purpose: Increments the user's monthly prescription scan quota.
    │       ├── Dependencies: `getCurrentUsage`, `supabaseAdmin`
    │       ├── Database tables touched: `usage_tracking` (UPSERT)
    │       └── External APIs touched: None
    │
    ├── calls parsePrescription()
    │   ├── Import path: Local function within `prescriptions.service.ts`
    │   ├── Purpose: Manages the OCR extraction, AI structuring, confidence computation, and saving medications.
    │   ├── Dependencies:
    │   │   ├── `ensureClosedBetaAccess`
    │   │   ├── `getAccessibleFamilyMemberIds`
    │   │   ├── `supabaseAdmin`
    │   │   ├── `downloadPrescriptionFile` (Local function)
    │   │   ├── `ocrProvider.parsePrescription` (from `../../services/ocr/ocr-provider.factory`)
    │   │   ├── `computeConfidence` (from `../../utils/confidenceEngine`)
    │   │   ├── `updatePrescriptionOcrOutput` (Local function)
    │   │   └── `writeAuditLog`
    │   ├── Database tables touched:
    │   │   ├── `prescriptions` (SELECT, INSERT, UPDATE)
    │   │   ├── `prescription_medications` (DELETE, INSERT)
    │   │   └── `prescription_uploads` (UPDATE)
    │   ├── External APIs touched: None directly (delegated to OCR/AI providers)
    │   │
    │   ├── calls downloadPrescriptionFile()
    │   │   ├── Import path: Local function within `prescriptions.service.ts`
    │   │   ├── Purpose: Downloads the image buffer from Supabase to feed into OCR.
    │   │   ├── Dependencies: `supabaseAdmin`
    │   │   ├── Database tables touched: None
    │   │   └── External APIs touched: Supabase Storage Bucket (`download`)
    │   │
    │   ├── calls ocrProvider.parsePrescription()
    │   │   ├── Import path: Dynamic via `Backend/src/services/ocr/ocr-provider.factory.ts`
    │   │   ├── Purpose: Factory implementation (e.g., `VisionGeminiOcrProvider`).
    │   │   ├── Dependencies: `extractTextWithGoogleVision` (from `./google-vision-text.ts`), `cleanOcrText`, `createAiProvider`
    │   │   ├── Database tables touched: None
    │   │   ├── External APIs touched:
    │   │   │   └── `extractTextWithGoogleVision()` hits `https://vision.googleapis.com/v1/images:annotate`
    │   │   │
    │   │   └── calls aiProvider.reason()
    │   │       ├── Import path: Dynamic via `Backend/src/services/ai/ai-provider.factory.ts`
    │   │       ├── Purpose: Factory implementation (e.g., `GeminiAiProvider`).
    │   │       ├── Dependencies: `GoogleGenAI` (SDK), `buildClinicalReasoningPrompt`, `validateReasoningResponse`
    │   │       ├── Database tables touched: None
    │   │       ├── External APIs touched: Google Gemini API / MedGemma Inference Endpoint
    │   │       │
    │   │       └── calls validateReasoningResponse()
    │   │           ├── Import path: `Backend/src/services/ai/validation.ts`
    │   │           ├── Purpose: Validates JSON response from LLM against Zod schema and attempts recovery.
    │   │           ├── Dependencies: `zod` (`reasoningResultSchema`)
    │   │           ├── Database tables touched: None
    │   │           └── External APIs touched: None
    │   │
    │   ├── calls computeConfidence()
    │   │   ├── Import path: `Backend/src/utils/confidenceEngine.ts`
    │   │   ├── Purpose: Assigns risk tiers and auto-accept scores to extracted medicines based on safety rules and catalog overlaps.
    │   │   ├── Dependencies:
    │   │   │   ├── `findMedicineCatalogMatch` (from `./medicineIntelligence`)
    │   │   │   ├── `findMedicineCatalogCorrectionCandidates` (from `./medicineIntelligence`)
    │   │   │   ├── `evaluateMedicineRelationships` (from `./medicineTrust`)
    │   │   │   └── `normalizeMedicineText` (from `./medicineTrust`)
    │   │   ├── Database tables touched: None (Relies on local sharded CSV arrays from `Assets/`)
    │   │   └── External APIs touched: None
    │   │
    │   └── calls updatePrescriptionOcrOutput()
    │       ├── Import path: Local function within `prescriptions.service.ts`
    │       ├── Purpose: Saves raw OCR and AI data to the DB.
    │       ├── Dependencies: `supabaseAdmin`
    │       ├── Database tables touched: `prescriptions` (UPDATE)
    │       └── External APIs touched: None
    │
    └── calls getPrescription()
        ├── Import path: Local function within `prescriptions.service.ts`
        ├── Purpose: Fetches the final saved state of the prescription to return to the caller.
        ├── Dependencies: `ensureClosedBetaAccess`, `getAccessibleFamilyMemberIds`, `supabaseAdmin`, `buildSignedPrescriptionUrl`
        ├── Database tables touched: `prescriptions` (SELECT with Joins)
        └── External APIs touched: Supabase Storage Bucket (`createSignedUrl`)
```