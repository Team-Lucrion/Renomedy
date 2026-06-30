# Renomedy Architecture Audit & Knowledge Transfer Report

## 1. Executive Summary

**What is this application?**
Renomedy is a family-oriented healthcare and prescription intelligence platform. It consists of a React Native (Expo) mobile frontend and a Node.js/Express backend.

**What problem does it solve?**
It helps families digitize, organize, and track medical prescriptions. Given the complexity of medical documents, especially in India, it extracts structured information (medicine names, dosages, timings) using OCR and AI, while acting as a centralized hub for tracking family medication adherence, refill alerts, and secure sharing via features like "Reno It" (WhatsApp cards).

**What are its primary features?**
* **Prescription Capture & OCR:** Uploading prescription images, processing them via OCR (either edge-based ML Kit or cloud-based Google Vision).
* **AI Medication Structuring:** Parsing OCR text into structured medical data (via Gemini or MedGemma).
* **Family Sanctuary:** Managing a hierarchical family structure for dependents with Caregiver coordination.
* **Tracker & Reminders:** Tracking active medication schedules, dose adherence (taken/missed/skipped), and automated refill alerts.
* **Safety & Intelligence Engine:** Validating medicines against a catalog, flagging risks (e.g., insulin), checking for overlaps, and requiring manual review for low confidence or high-risk parses.

**High-level architecture overview:**
Renomedy uses a Client-Server architecture. The frontend is built on Expo (React Native) for cross-platform mobile support. The backend is an Express Node.js API that handles complex business logic, orchestrates AI and OCR factory services, coordinates scheduled cron jobs (reminders, refills), and interfaces with Supabase (PostgreSQL database + storage) for state management. Authentication is powered by Clerk, synchronizing identity via webhooks to the backend database.

---

## 2. Repository Structure

The project is structured as a monorepo containing two main workspaces:

### `Frontend/` (React Native Expo App)
* `src/components/`: Reusable UI components (Modals, Avatars, Cards).
* `src/context/`: Global React Contexts (e.g., `AppDataContext` for state, `LanguageContext`).
* `src/data/`: Static data and logic (e.g., `indianMedicines.js` containing local medicine catalog intelligence).
* `src/lib/`: API clients, analytics (PostHog tracking), and core utilities.
* `src/navigation/`: App routing configuration (`AppNavigator.tsx`).
* `src/screens/`: High-level views (e.g., `HomeScreen`, `PrescriptionHubScreen`, `TrackerScreen`).
* `src/theme/`: Global styling constants (colors, typography, spacing).
* `src/utils/`: Frontend business logic (e.g., `medicineSafety.ts`, `medicineTrust.ts`, `onboardingFlow.ts`).

### `Backend/` (Express API)
* `src/modules/`: Domain-driven module separation. Each folder (e.g., `auth`, `prescriptions`, `users`, `family`, `medications`, `dashboard`, `admin`, `payments`, `subscriptions`, `notifications`) contains routes, controllers, services, and schemas (Zod).
* `src/services/`: Shared, cross-cutting services.
  * `ai/`: AI Provider factory (`Gemini`, `MedGemma`) and prompt logic.
  * `ocr/`: OCR Provider factory (`Google Vision`, `Tesseract`, etc.).
  * `scheduler/`: Cron-based jobs for reminders and refills.
* `src/middleware/`: Express middlewares (Auth validation, rate limits, error handling).
* `src/utils/`: Helper utilities (e.g., `confidenceEngine.ts`, `medicineIntelligence.ts`).
* `src/config/`: Configuration setup (`env.ts`, `logger.ts`).
* `supabase/`: Database migration SQL scripts and configurations.

### `Assets/`
Contains canonical datasets and CSVs for the medicine intelligence catalog.

**Dependency relationships:**
The frontend relies heavily on the backend via REST API calls. The backend modules are highly decoupled but rely heavily on `src/services/` (e.g., `prescriptions.service.ts` calls `ocr-provider.factory.ts` and `ai-provider.factory.ts`).

---

## 3. Frontend Architecture

* **Entry points:** `App.tsx` (or `index.ts`), which wraps the application in contexts and renders `src/navigation/AppNavigator.tsx`.
* **Routing structure:** Uses `@react-navigation/native-stack` for authentication and full-screen flows (Login, Onboarding, Modals) and `@react-navigation/drawer` for the main authenticated interface (`MainTabs`).
* **State management:** Context API (`AppDataContext`). Relies on a global `refreshAll` polling/sync mechanism rather than granular Redux/Zustand slices.
* **Authentication flow:** Utilizes `@clerk/expo`. The session token is passed via HTTP headers in the `api` lib to the backend.
* **UI component hierarchy:** Screens compose smaller domain-specific pieces (e.g., `PrescriptionHubScreen` using `RenoItModal`, `UpgradeModal`).
* **API communication layer:** Encapsulated in `Frontend/src/lib/api.ts`. Includes standard fetch wrappers and specific `XMLHttpRequest` usage for multipart file uploads (like `scanPrescription`) to handle progress tracking.
* **Data flow:** User Interaction -> Screen State -> API Lib (`fetch`/`XHR`) -> Backend Processing -> Response -> Global Context Sync (`refreshAll`) -> UI Re-render.

### Major Screens
1. **HomeScreen (`HomeScreen.tsx`)**
   * **Purpose:** Dashboard overview of the family sanctuary.
   * **Components:** Custom Drawer menu, stats grid, family member list, active medication cards, alert banners.
   * **Backend Services:** Calls `/dashboard/family-overview` indirectly via `AppDataContext`.
   * **User journey:** The user logs in, sees active schedules, pending refills, and quick action buttons to jump into adding medicines.

2. **Prescription Hub (`PrescriptionHubScreen.tsx`)**
   * **Purpose:** The core engine for adding and verifying prescriptions.
   * **Components:** Image Pickers (Camera/Gallery), Upload Progress, OCR text preview, Medicine verification forms (`renderEditableField`, `renderActivationPrompt`), "Reno It" WhatsApp sharing.
   * **Backend Services:** `scan-prescription` (upload/process), `manual-draft` (creation), `/prescriptions/:id/medications` (CRUD for parsed items), `/medications/activate` (turning a prescription draft into an active schedule).
   * **User journey:** User uploads a photo -> Wait for OCR & AI progress -> Review the extracted Drafts one by one -> Handle high-risk/overlap warnings -> Activate medicine.

3. **Tracker / Medications (`TrackerScreen.tsx` - Not explicitly provided but inferred)**
   * **Purpose:** Daily adherence logging.
   * **User journey:** Check off medications as "taken", "skipped", or "snoozed".

4. **Family Sanctuary (`FamilyScreen.tsx` / `AddFamilyMemberScreen.tsx`)**
   * **Purpose:** Managing dependents and caregiver roles.
   * **User journey:** Adding a patient profile so prescriptions can be assigned to them.

---

## 4. Backend Architecture

* **Entry points:** `Backend/src/server.ts` handles listening. `Backend/src/app.ts` configures Express.
* **API structure:** RESTful design with versioning (e.g., `/api/v2/prescriptions/process`).
* **Service layer:** `src/modules/*/` isolates business logic in `.service.ts` files, orchestrated by `.controller.ts` files.
* **Business logic layer:** Handles complex safety checks (e.g., `confidenceEngine.ts`, duplicate detection, `medicineSafety.ts`).
* **Database layer:** Supabase JS client (`@supabase/supabase-js`) using both `supabaseAdmin` (service role) and `getUserSupabaseClient` (RLS-enforced user client).
* **Middleware:** `helmet`, `cors`, `pino-http` (logging), `apiRateLimiter`, `observabilityMiddleware`, `requireAuth` (JWT verification), `validateBody` (Zod schemas).
* **Authentication and authorization:** Requests are intercepted by `requireAuth` to validate the Clerk token. Authorized endpoints rely heavily on Supabase Row Level Security (RLS) and manual checks (`getAccessibleFamilyMemberIds`) to ensure isolation.

### Major Endpoints (Focusing on Prescriptions & Auth)
1. **POST `/auth/clerk-webhook`**
   * **Purpose:** Sync Clerk users to Supabase.
   * **Format:** Svix-verified JSON body from Clerk.
   * **Services Called:** `auth.service.ts` (`processClerkWebhook`, `upsertClerkUser`).
2. **POST `/api/scan-prescription`**
   * **Purpose:** Main entry for mobile image uploads.
   * **Request:** Multipart form data (Image) + metadata (family_member_id).
   * **Response:** OCR parse results, confidence scores, structured medicines array.
   * **Services Called:** `prescriptions.service.ts` (`resolvePrescriptionScanFile`, `decodePrescriptionUpload`), `ocr-provider.factory.ts`, `ai-provider.factory.ts`.
3. **POST `/api/v2/prescriptions/process`**
   * **Purpose:** Edge-first OCR path. Decouples text extraction from AI reasoning.
   * **Request:** JSON containing `extractedText`, `ocrMetadata`, `family_member_id`.
   * **Services Called:** `parsePrescription` bypassing image download.
4. **POST `/prescriptions/:id/reconcile`**
   * **Purpose:** Resolve conflicts between newly scanned medicines and existing active schedules.
   * **Request:** Array of `actions` (`replace_existing`, `add_new`, `keep_active`).
   * **Services Called:** `reconcilePrescription` in `prescriptions.service.ts`.

---

## 5. Database Analysis

* **Technology used:** PostgreSQL via Supabase.
* **Relationships:** Heavily relational, anchored on `users` and `family_groups`.
* **Data lifecycle:** Soft deletes are used in some places (e.g., `is_archived` on members), but many deletes are cascading (e.g., deleting a family member drops their prescriptions).

### Schema Breakdown (Key Tables)

1. **`users`**
   * **Purpose:** Maps Clerk identity to the local database.
   * **Fields:** `id` (UUID), `clerk_user_id`, `role`, `preferred_language`.
   * **Used:** In `current_user_id()` Postgres function for RLS.

2. **`family_groups` & `family_members`**
   * **Purpose:** Multi-tenant isolation. Users belong to groups, and members (patients) belong to groups.
   * **Fields:** `owner_user_id`, `relationship`, `chronic_conditions`.
   * **Used:** Every prescription and schedule must tie back to a `family_member_id`.

3. **`prescriptions`**
   * **Purpose:** Document metadata and extraction state.
   * **Fields:** `image_url`, `raw_ocr_text`, `cleaned_ocr_text`, `parsed_medicine_json`, `parse_status`, `verification_status`.
   * **Used:** The parent record for the OCR pipeline.

4. **`prescription_medications`**
   * **Purpose:** Structured medicines extracted from a prescription (or manually entered).
   * **Fields:** `medicine_name`, `dosage`, `frequency`, `timing`, `confidence_score`, `requires_manual_verification`.
   * **Used:** Draft representations reviewed by the user in the UI.

5. **`medication_schedules`**
   * **Purpose:** Active, recurring reminders.
   * **Fields:** `prescription_medication_id`, `reminder_times`, `status` ('active', 'completed').
   * **Used:** Drives the reminder scheduler and dashboard state.

6. **`dose_logs`**
   * **Purpose:** Adherence tracking.
   * **Fields:** `medication_schedule_id`, `status` ('taken', 'missed', 'skipped').

7. **`refill_states`**
   * **Purpose:** Inventory tracking.
   * **Fields:** `quantity_remaining`, `continuity_status` ('risk_soon', 'out_of_stock').

8. **`subscription_plans` & `user_subscriptions` & `usage_tracking`**
   * **Purpose:** Monetization, tiering, and limit enforcement.
   * **Fields:** `scan_limit_monthly`, `plan_slug`.

---

## 6. Authentication System

* **Sign-up & Login flow:** Handled entirely by Clerk's pre-built UI components on the frontend (`@clerk/expo`).
* **Session management & Token handling:** Clerk manages the session lifecycle. The frontend appends the active JWT to outgoing API requests. The backend uses a `requireAuth` middleware to verify the token via `@clerk/backend`.
* **Role handling:** While Clerk may have its own metadata, Renomedy maintains a `role` field in the local `users` table (e.g., `caregiver`, `self`).
* **Complete Authentication Lifecycle:**
  1. User signs up via Clerk (Frontend).
  2. Clerk triggers a `user.created` webhook to the Backend (`/auth/clerk-webhook`).
  3. The Backend verifies the Svix signature to ensure payload integrity.
  4. The Backend (`upsertClerkUser`) inserts the new user into the Supabase `users` table, setting the initial `role`.
  5. The Frontend fetches the session token and sends it with standard API requests.
  6. Backend middleware authenticates the request and queries Supabase using the `current_user_id()` function to enforce Row Level Security (RLS).

---

## 7. OCR Pipeline Analysis

**Complete OCR flow:**

```text
User Image Upload -> React Native -> Backend API -> Storage Bucket -> OCR Provider Factory -> Raw Text
```

**Step-by-step:**
1. **User uploads image:** The user selects an image from the camera or gallery using Expo Image Picker in `PrescriptionHubScreen.tsx`.
2. **Image preprocessing:** The image is resized down to a maximum width (1800px) and compressed using `expo-image-manipulator` before transmission to save bandwidth.
3. **OCR Execution:**
   * The frontend calls `POST /api/scan-prescription` as a multipart form data request (to track upload progress).
   * The backend `prescriptions.service.ts` saves the image to a Supabase Storage bucket.
   * The `OcrProviderFactory` determines which provider to use based on the `OCR_PROVIDER` env variable (e.g., VisionGemini).
4. **Text extraction:** The provider (e.g., Google Cloud Vision) extracts the raw unstructured text.
5. **Parsing logic:** The raw text is passed to the AI Pipeline (see below).
6. **Validation:** Extracted and parsed medicines are validated by `medicineSafety.ts` to flag any critical safety issues (like missing dosages or high-risk drugs like insulin).
7. **Storage:** The `raw_ocr_text`, `cleaned_ocr_text`, and structured `parsed_medicine_json` are written back to the `prescriptions` row, and the individual medicines are inserted into `prescription_medications`.
8. **User response:** The structured data is returned to the frontend. The `PrescriptionHubScreen` updates its state, rendering each medication as an unverified draft card requiring manual verification.

**Error handling:**
If the OCR provider times out or fails (e.g., no text detected), the failure reason is logged, and a specific "We could not read this prescription clearly" error is surfaced. The user is prompted to try a manual entry fallback.

---

## 8. AI Pipeline Analysis

**Complete AI workflow:**

```text
Raw OCR Text -> AiProviderFactory -> LLM (Gemini/MedGemma) -> JSON Parsing -> Zod Validation -> Confidence Engine -> Structured Output
```

* **Where AI is called:** Immediately after text extraction, inside the `OcrProvider` implementation (e.g., `VisionGeminiOcrProvider`), which calls `aiProvider.reason(text)`.
* **Which models are used:** Configurable via `AI_PROVIDER` (defaults to `gemini` using `gemini-2.0-flash`, or `medgemma` utilizing a local MedGemma deployment).
* **Validation:** Responses are parsed into a strict JSON structure. `validation.ts` uses Zod to validate the output against expected schemas (`OcrCardData`). Partial schema failures trigger recovery logic to salvage valid medications.
* **Confidence handling:** The `ConfidenceEngine` (`confidenceEngine.ts`) evaluates the output. It assigns a score based on missing required fields, contradictory dosages, and clinical risk tiers (P0/P1). Any critical flag overrides the confidence to "Manual Verification Required."
* **Failure handling:** If the AI fails to parse the structure, it returns a `raw_detected_text_summary` so the user is not completely blocked and can proceed with manual entry using the raw text as a guide.

---

## 9. Prescription Processing Lifecycle

**Sequence Flow:**

```text
1. Frontend (PrescriptionHubScreen): User uploads image.
2. Frontend (api.ts): POST /api/scan-prescription (Multipart).
3. Backend (prescriptions.controller.ts): Routes to `decodePrescriptionUpload`.
4. Backend (prescriptions.service.ts): `uploadPrescription()`
   -> Saves to Supabase Storage bucket.
   -> Inserts pending `prescriptions` DB row.
5. Backend (prescriptions.service.ts): `parsePrescription()`
   -> Calls `ocrProvider.parsePrescription()` (OCR Extraction + AI Structuring).
   -> Calls `computeConfidence()` for each medicine.
6. Backend (prescriptions.service.ts):
   -> Updates `prescriptions` with `raw_ocr_text` and `parsed_medicine_json`.
   -> Inserts individual `prescription_medications`.
7. Backend: Returns structured JSON response.
8. Frontend (PrescriptionHubScreen): Displays Medicine Cards.
9. Frontend (User Action): User verifies and edits fields.
10. Frontend (PrescriptionHubScreen): User taps "Activate Medicine".
11. Backend (medications.controller.ts): POST `/medications/activate`
    -> Turns `prescription_medications` draft into an active `medication_schedules`.
```

---

## 10. Error Handling Audit

**Major workflows & Failure Modes:**

* **Upload Network Failure:** Caught by Axios/Fetch interceptor in `api.ts`; displays a standard network error banner.
* **OCR Text Extraction Failure:** If the image is blurry, Vision/ML Kit returns an empty string. The backend detects this and throws an `OCR_FAILED` HttpError. The frontend displays "We could not clearly read this prescription."
* **AI Parsing Failure (Hallucination/Bad JSON):** If the LLM output fails Zod validation entirely, the pipeline falls back to saving the raw text and prompts the user to add medicines manually.
* **Database Write Failure:** Wrapped in Express error-handling middleware. Reverts actions where possible and logs to Sentry.
* **Medicine Overlap/Conflict:** During activation, `evaluateMedicineRelationships` checks for duplicate active medicines. If a conflict is found, activation is blocked until the user explicitly resolves it via the Reconcile modal.
* **Fallback Mechanisms:** Manual entry is the ultimate fallback for both OCR and AI failures. A `manual-draft` endpoint creates a blank prescription to attach manually typed medicines to.

---

## 11. External Integrations

| Service | Purpose | Configuration Location | API Usage / Failure Impact |
| :--- | :--- | :--- | :--- |
| **Clerk** | Authentication & Identity | Frontend & Backend `.env` | Triggers webhooks to sync users. Failure prevents login/syncing. |
| **Supabase** | PostgreSQL Database & Storage | Backend `.env` (`SUPABASE_URL`, Keys) | Core data store. Uses PostgREST. Failure breaks the entire app. |
| **Google Cloud Vision** | OCR (Cloud fallback) | Backend `.env` | Extracts text from images. Failure degrades to manual entry. |
| **Gemini (Google AI)** | AI Structuring | Backend `.env` (`GEMINI_API_KEY`) | Parses OCR text to JSON. Failure degrades to raw text display. |
| **PostHog** | Analytics | Frontend & Backend `.env` | Tracks usage metrics. Failure drops events silently. |
| **Sentry** | Error Tracking | Frontend & Backend `.env` | Logs unhandled exceptions. Failure drops error logs. |

---

## 12. Environment Configuration

### Frontend (`Frontend/.env`)
* `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk auth integration.
* `EXPO_PUBLIC_API_BASE_URL`: Pointer to the Backend Express API.
* `EXPO_PUBLIC_RENO_IT_LANDING_URL`: URL for the WhatsApp sharing "Reno It" feature.

### Backend (`Backend/.env`)
* **Core:** `PORT`, `NODE_ENV`.
* **Database:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Used for bypassing RLS during admin/webhook tasks).
* **Auth:** `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`.
* **AI/OCR:** `OCR_PROVIDER`, `GEMINI_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`.
* **Schedulers:** `ENABLE_SCHEDULER`, `CRON_REMINDER_SCAN`.

---

## 13. Dependency Audit

### Frontend (React Native / Expo)
* `@clerk/expo`: Auth.
* `@react-navigation/*`: App routing.
* `expo-image-picker` / `expo-image-manipulator`: Camera and image resizing.
* `react-i18next`: Localization.

### Backend (Node.js / Express)
* `express`, `cors`, `helmet`: Web server foundation.
* `@supabase/supabase-js`: Database interaction.
* `@clerk/backend`: Token validation.
* `svix`: Clerk webhook signature verification.
* `zod`: Request payload validation.
* `@google/genai`, `google-auth-library`: OCR and AI integrations.
* `multer`: Multipart file uploads handling.
* `node-cron`: Background job scheduling.

---

## 14. Current System Architecture Diagram

```text
       [ User (Mobile App) ]
                |
                v
       +-------------------+
       | Frontend (Expo)   | --> [ Clerk (Auth) ]
       | - Image Picker    |
       | - Local Catalog   |
       +-------------------+
                | (REST API / JSON / Multipart)
                v
       +-------------------+
       | Backend (Express) | <---- (Webhooks) ---- [ Clerk ]
       | - Middleware      |
       | - Controllers     |
       +-------------------+
          |            |
          v            v
[ OCR Factory ]   [ AI Factory ]
 (Google Vision)   (Gemini/MedGemma)
          |            |
          +-----+------+
                |
                v
       +-------------------+
       | Supabase (DB)     |
       | - PostgreSQL      |
       | - Object Storage  |
       +-------------------+
```

---

## 15. Knowledge Transfer Report

**Welcome to the Renomedy Engineering Team!**

### How does the application work?
Renomedy is a multi-tenant family health app. Users log in, create a "Sanctuary" (family group), add family members, and upload prescriptions for those members. The system uses OCR to read the text and an LLM to parse it into structured medicines. The user verifies these medicines, which then turn into active schedules that trigger adherence reminders and refill alerts.

### What are the most important files?
* `Frontend/src/screens/PrescriptionHubScreen.tsx`: The heart of the app. Handles uploading, progress, and verification UI.
* `Backend/src/modules/prescriptions/prescriptions.service.ts`: The core orchestration engine. It manages the flow between storage, OCR, AI, and the database.
* `Backend/src/services/ocr/ocr-provider.factory.ts`: Manages which OCR engine is used.
* `Backend/src/utils/confidenceEngine.ts` & `Backend/src/utils/medicineSafety.ts`: Critical clinical safety logic.

### What should I understand first?
1. **The Database Schema:** Understand how `users` -> `family_groups` -> `family_members` -> `prescriptions` -> `prescription_medications` -> `medication_schedules` are linked. Everything revolves around the `family_member_id`.
2. **The Verification Flow:** Understand that OCR output is *never* fully trusted. It is saved as a draft (`requires_manual_verification = true`). The user *must* explicitly verify it before it becomes an active schedule.

### What should I avoid changing without understanding?
* **Safety & Trust Engines (`medicineSafety.ts`):** This is the clinical backbone. Modifying the duplicate detection or insulin-blocking logic can cause serious clinical risk (alert fatigue or missed dangerous overlaps).
* **Supabase RLS Policies:** Modifying the `current_user_id()` function or the Row Level Security policies can inadvertently leak medical data between families.
* **Multipart Form Uploads:** The frontend uses `XMLHttpRequest` specifically to get upload progress for large images. Swapping this to a standard `fetch` without progress tracking will break the UX.

### What are the critical workflows?
1. **The Auth Webhook:** If the Clerk webhook (`/auth/clerk-webhook`) fails to sync, the user cannot do anything, as their identity won't exist in the Postgres database.
2. **Prescription Processing (`/api/scan-prescription`):** This is the most complex endpoint, coordinating file storage, third-party APIs (Vision/Gemini), and complex database inserts.
