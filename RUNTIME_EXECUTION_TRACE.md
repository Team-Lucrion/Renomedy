# Renomedy Runtime Execution Trace

## Flow 1 — Scan Prescription

User taps "Scan Prescription"

Frontend/src/screens/PrescriptionHubScreen.tsx
└── beginAddFlow() [Line 984]
    ├── Purpose: Orchestrates the add/upload flow.
    ├── Input: `flow: { type: 'upload', source: 'camera' | 'gallery' } | { type: 'manual' }`
    └── calls selectImage(flow.source) [Line 993]

Frontend/src/screens/PrescriptionHubScreen.tsx
└── selectImage() [Line 1042]
    ├── Purpose: Triggers native camera/gallery picker and resizes image.
    ├── Input: `source: 'camera' | 'gallery'`
    ├── calls ImagePicker.launchCameraAsync() or ImagePicker.launchImageLibraryAsync()
    ├── calls prepareImageForUpload(pickerResult.assets[0]) [Line 1089]
    └── calls uploadAndParse(finalImage) [Line 1093]

Frontend/src/screens/PrescriptionHubScreen.tsx
└── uploadAndParse() [Line 1103]
    ├── Purpose: Coordinates API call for scanning image and manages UI upload state.
    ├── Input: `imageOverride?: SelectedImage`
    └── calls scanPrescription(imageToUpload.uri, targetFamilyMember.id) [Line 1156]

Frontend/src/lib/api.ts
└── scanPrescription() [Line 198]
    ├── Purpose: Converts image into multipart FormData and sends XHR to track progress.
    ├── Input: `imageUri, familyMemberId, extractedText, ocrMetadata`
    ├── Request: `POST /api/scan-prescription`
    └── Returns: Promise<ScanPrescriptionResponse>

Backend/src/modules/prescriptions/prescriptions.routes.ts
└── prescriptionScanRouter.post("/scan-prescription") [Line 104]
    ├── calls requireAuth (Middleware)
    ├── calls scanPrescriptionUpload (Multer Middleware)
    ├── calls validateBody(scanPrescriptionBodySchema)
    └── calls asyncHandler(scanPrescriptionHandler)

Backend/src/modules/prescriptions/prescriptions.controller.ts
└── scanPrescriptionHandler() [Line 83]
    ├── Purpose: Controller logic for resolving image vs base64 vs extracted text.
    ├── Input: `req, res`
    ├── calls resolvePrescriptionScanFile() [Line 95]
    └── calls decodePrescriptionUpload() [Line 120]

Backend/src/modules/prescriptions/prescriptions.service.ts
└── decodePrescriptionUpload() [Line 446]
    ├── Purpose: Master orchestrator. Saves file and triggers OCR/AI pipeline.
    ├── Input: `{ jwt, clerkUserId, file, body }`
    ├── calls uploadPrescription(input) [Line 452]
    │   ├── Input: `{ jwt, clerkUserId, file, body }`
    │   ├── Database Write: `supabaseAdmin.storage.from(env.SUPABASE_STORAGE_BUCKET).upload()` [Line 379]
    │   ├── Database Write: `supabaseAdmin.from("prescriptions").insert()` [Line 396]
    │   ├── Database Write: `supabaseAdmin.from("prescription_uploads").insert()` [Line 420]
    │   └── Returns: `{ ...prescription, image_url }`
    ├── calls parsePrescription(jwt, uploaded.id, options) [Line 453]
    │   ├── Purpose: Executes external OCR & AI services.
    │   ├── calls currentOcrProvider().parsePrescription(imageBuffer, options) [Line 651]
    │   │   ├── (E.g., VisionGeminiOcrProvider) [Line 16]
    │   │   ├── calls extractTextWithGoogleVision(imageBuffer) [Line 24]
    │   │   └── calls aiProvider.reason(cleanedText) [Line 49]
    │   │       ├── (E.g., GeminiAiProvider) [Line 11]
    │   │       ├── Input: `text (string)`
    │   │       ├── Output: `AiReasoningResult`
    │   │       └── calls validateReasoningResponse() [Line 37]
    │   ├── calls computeConfidence(signal, existingMedicines) [Line 673]
    │   │   ├── Location: Backend/src/utils/confidenceEngine.ts [Line 34]
    │   │   ├── Input: `signal: MedicationSignal, existingMedicines: Array`
    │   │   ├── Output: `ConfidenceResult { confidenceScore, level, validationFailures }`
    │   │   └── Evaluates overlap rules and triggers P0 override alerts.
    │   ├── Database Write: `supabaseAdmin.from("prescriptions").update()` [Line 701]
    │   ├── Database Write: `supabaseAdmin.from("prescription_medications").insert()` [Line 706]
    │   ├── Database Write: `supabaseAdmin.from("prescription_uploads").update()` [Line 728]
    │   └── Returns: `ParseStatus`
    └── calls getPrescription() [Line 457]
        ├── Database Read: `supabaseAdmin.from("prescriptions").select().single()` [Line 784]
        └── Returns: `PrescriptionDetails`

Backend/src/modules/prescriptions/prescriptions.controller.ts
└── mapPrescriptionToScanResponse(data) [Line 131]
    ├── Purpose: Shapes DB response into API format for frontend.
    ├── Output: `ScanPrescriptionResponse`
    └── Returns to HTTP client `res.status(200).json()`

Frontend/src/screens/PrescriptionHubScreen.tsx
└── uploadAndParse() (Continuation) [Line 1166]
    ├── updates React states: `setDecodedPrescription(details)` [Line 1167]
    ├── calls refreshAll() [Line 1183] (Syncs AppDataContext)
    └── UI re-renders Medicine Cards (renderMedicineCards() via React lifecycle).

---

## Flow 2 — Activate Medication

User taps "Activate Medication"

Frontend/src/screens/PrescriptionHubScreen.tsx
└── activateVerifiedMedicine() [Line 1722]
    ├── Purpose: Takes a verified draft medicine and asks the backend to create an active schedule.
    ├── Input: `medicine: ParsedPrescriptionMedication`
    ├── calls getCatalogQueryForMedication() [Line 1731]
    ├── calls getSupportModeSafety() [Line 1736]
    ├── calls detectExcludedMedicine() [Line 1725] (Checks if drug is insulin/banned)
    ├── calls saveVerificationDraft() [Line 1808] (Updates DB text if user edited it)
    └── calls api.post('medications/activate', payload) [Line 1812]

Frontend/src/lib/api.ts
└── api.post()
    ├── Request: `POST /api/medications/activate`
    └── Sends bearer token.

Backend/src/modules/medications/medications.routes.ts
└── medicationsRouter.post("/activate") [Line 10]
    ├── calls requireAuth
    ├── calls validateBody(activateMedicationSchema)
    └── calls asyncHandler(activateMedicationHandler)

Backend/src/modules/medications/medications.controller.ts
└── activateMedicationHandler() [Line 5]
    └── calls activateMedication(req.auth!.token, req.body) [Line 6]

Backend/src/modules/medications/medications.service.ts
└── activateMedication() [Line 52]
    ├── Purpose: Converts parsed medication to active schedule & creates refill tracking.
    ├── Input: `jwt, input (payload)`
    ├── Database Read: `supabaseAdmin.from("prescription_medications").select().single()` [Line 60]
    ├── calls getMedicineSupportSafety() [Line 100]
    ├── Database Read: `supabaseAdmin.from("medication_schedules").select()` (Checks for active conflicts) [Line 148]
    ├── calls evaluateMedicineRelationships() [Line 158] (Checks exact/fuzzy dupes)
    ├── Database Write: `supabaseAdmin.from("medication_schedules").insert()` [Line 192]
    ├── Database Write: `supabaseAdmin.from("prescription_medications").update({continuity_status: 'active'})` [Line 195]
    ├── Database Write: (Optional) Stops replaced schedule if requested [Line 204]
    ├── Database Write: `supabaseAdmin.from("refill_states").upsert()` [Line 223]
    └── Returns: Created `medication_schedule` record.

Frontend/src/screens/PrescriptionHubScreen.tsx
└── activateVerifiedMedicine() (Continuation) [Line 1831]
    ├── calls AsyncStorage.setItem(GUIDED_VERIFICATION_FIRST_COMPLETED_KEY, 'true')
    ├── updates React state: `setActivatedMedicationIds()` [Line 1840]
    └── calls refreshAll() [Line 1856] -> Triggers UI Refresh.

---

## Flow 3 — User Login

User logs in through Clerk

Frontend/src/screens/LoginScreen.tsx
└── handlePrimaryAuth() [Line 64]
    ├── Purpose: Executes sign-in/sign-up through Clerk SDK.
    ├── Input: form state (email, password)
    ├── calls signIn.create() or signUp.create() [Line 84 / 99]
    └── calls setSignInActive({ session }) [Line 90] (Clerk SDK saves JWT internally)

Frontend/src/navigation/AppNavigator.tsx
└── AppNavigator() React Component [Line 165]
    ├── `const { isLoaded, isSignedIn } = useAuth();` [Line 167]
    ├── Clerk context updates to `isSignedIn === true`
    └── Switches Stack.Screen from "Login" to "MainTabs" [Line 188]

[Backend Webhook Flow (Async)]
Clerk Backend -> Backend/src/modules/auth/auth.routes.ts
└── POST `/auth/clerk-webhook`
    └── calls clerkWebhookHandler()

Backend/src/modules/auth/auth.controller.ts
└── clerkWebhookHandler() [Line 15]
    └── calls processClerkWebhook(req) [Line 16]

Backend/src/modules/auth/auth.service.ts
└── processClerkWebhook() [Line 64]
    ├── Purpose: Validates Svix signature and writes user to DB.
    ├── Input: Express Request
    ├── calls `wh.verify()` (Svix signature validation) [Line 81]
    └── calls upsertClerkUser() [Line 99]
        ├── Input: `{ clerkUserId, email, fullName, role }`
        ├── Database Write: `supabaseAdmin.from("users").upsert()` [Line 20]
        └── Returns: Synced local user DB record.

[Frontend Data Sync Flow (Next API Call)]
Frontend/src/context/AppDataContext.tsx
└── refreshAll() [Line 189]
    ├── calls `api.post("auth/sync-clerk-user")` [Line 209]
    └── Any API route hits `requireAuth` middleware.

Backend/src/middleware/auth.ts
└── requireAuth() [Line 15]
    ├── Purpose: Verifies JWT via Clerk Backend SDK.
    ├── calls getBearerToken(req) [Line 17]
    ├── calls verifyToken(token, { secretKey }) [Line 19]
    └── Adds `req.auth = { clerkUserId, token }` and calls `next()`.

---

## Flow 4 — Family Member Creation

User adds family member

Frontend/src/screens/AddFamilyMemberScreen.tsx
└── handleSave() [Line 125]
    ├── Purpose: Validate input and send creation request.
    ├── Input: Local state strings (name, age, relationship, etc)
    ├── calls addFamilyMember(payload) [Line 158]
    └── calls navigation.goBack() [Line 161]

Frontend/src/context/AppDataContext.tsx
└── addFamilyMember() [Line 513]
    ├── Purpose: Execute API call.
    ├── Input: Payload dictionary.
    ├── calls api.post("family/add-member", payload) [Line 532]
    └── calls refreshAll() [Line 547]

Backend/src/modules/family/family.routes.ts
└── familyRouter.post("/add-member") [Line 16]
    ├── calls requireAuth
    ├── calls validateBody(addFamilyMemberSchema)
    └── calls asyncHandler(addFamilyMemberHandler)

Backend/src/modules/family/family.controller.ts
└── addFamilyMemberHandler() [Line 10]
    └── calls addFamilyMember(req.auth!.token, req.body) [Line 11]

Backend/src/modules/family/family.service.ts
└── addFamilyMember() [Line 340]
    ├── Purpose: Enforces membership limits and writes patient record.
    ├── Input: `jwt, input`
    ├── Database Read: `supabaseAdmin.from("family_members").select(count)` [Line 345] (Checks member limit limits)
    ├── calls assertFeatureAccess() [Line 355]
    ├── Database Write: `sb.from("family_members").insert()` [Line 358]
    └── Returns: `family_member` DB row.

Frontend/src/context/AppDataContext.tsx
└── refreshAll() [Line 189]
    ├── Re-fetches `/family/list` and `/dashboard/family-overview`
    └── Triggers React UI to re-render the dashboard showing the new member.

---

## Flow 5 — Dashboard Load

User opens app

Frontend/src/navigation/AppNavigator.tsx
└── Render `MainTabs` containing `HomeScreen`.

Frontend/src/screens/HomeScreen.tsx
└── HomeScreen() [Line 27]
    ├── Reads states from `useAppData()`: `overview, schedules, refillStates, error` [Line 31]
    └── Calls `refreshAll()` on initial mount / pull-to-refresh.

Frontend/src/context/AppDataContext.tsx
└── refreshAll() [Line 189]
    ├── Purpose: Fetches the entire global state in parallel.
    ├── Input: None.
    └── calls Promise.allSettled() [Line 233]
        ├── api.get("family/list")
        ├── api.get("dashboard/family-overview")
        ├── api.get("medications/schedules")
        ├── api.get("medications/refill-status")
        ├── api.get("prescriptions/history")
        └── api.get("subscriptions/me")

Backend/src/modules/dashboard/dashboard.routes.ts
└── dashboardRouter.get("/family-overview") [Line 8]
    ├── calls requireAuth
    └── calls asyncHandler(getFamilyOverviewHandler)

Backend/src/modules/dashboard/dashboard.controller.ts
└── getFamilyOverviewHandler()
    └── calls getFamilyOverview(req.auth!.token)

Backend/src/modules/dashboard/dashboard.service.ts
└── getFamilyOverview() [Line 5]
    ├── Purpose: Perform aggregations for the global sanctuary stats.
    ├── Input: `jwt`
    ├── calls getUserSupabaseClient(jwt) [Line 7]
    ├── Database Read (Parallel via Promise.all): [Line 10]
    │   ├── `sb.from("family_members").select("id").eq("is_archived", false)`
    │   ├── `sb.from("medication_schedules").select("id, status")`
    │   ├── `sb.from("dose_logs").select("id, status, created_at").gte(24h ago)`
    │   └── `sb.from("refill_states").select("id, continuity_status")`
    └── Returns: Aggregated JSON `{ family_members_count, active_schedules_count, missed_doses_last_24h, refill_risk_count }` [Line 26]

Frontend/src/context/AppDataContext.tsx
└── refreshAll() (Continuation)
    ├── updates React state: `setOverview(results[1].value)` [Line 279]
    └── triggers re-render across application.

Frontend/src/screens/HomeScreen.tsx
└── HomeScreen() (Re-render)
    ├── Parses updated Context variables.
    ├── Calculates `activeScheduleRecords`, `refillAlerts`.
    ├── Renders `<View style={styles.statsGrid}>` utilizing `overview.family_members_count` etc.
    ├── Renders `<View style={styles.familyList}>` rendering member badges.
    └── Renders active medicine reminder cards.
