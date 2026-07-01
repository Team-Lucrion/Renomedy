# RENOMEDY SYSTEM MAP

## SYSTEM OVERVIEW

Renomedy
├── Identity & Authentication
├── Family Management
├── Prescription Intelligence
├── Medication Tracking
├── Refill Monitoring
├── Safety Engine
├── Caregiver Coordination
├── Notifications
├── Analytics
├── Billing & Subscription
└── Infrastructure

### Identity & Authentication
* **Purpose:** Manages user identity, registration, login, and synchronizes state between Clerk and the local database.
* **Files involved:** `Backend/src/modules/auth/auth.controller.ts`, `Backend/src/modules/auth/auth.service.ts`, `Backend/src/middleware/auth.ts`, `Frontend/src/lib/api.ts`
* **Primary services:** Clerk Webhook Processing, Token Verification.
* **Database tables:** `users`
* **External integrations:** Clerk

### Family Management
* **Purpose:** Multi-tenant isolation for families. Manages hierarchical family structure, members (patients), caregivers, and permissions.
* **Files involved:** `Backend/src/modules/family/family.controller.ts`, `Backend/src/modules/family/family.routes.ts`
* **Primary services:** Family Group CRUD, Invite Management.
* **Database tables:** `family_groups`, `family_members`, `family_group_memberships`
* **External integrations:** None

### Prescription Intelligence
* **Purpose:** Captures prescription images, processes them via OCR, extracts structured data using AI, and presents them for verification.
* **Files involved:** `Backend/src/modules/prescriptions/prescriptions.controller.ts`, `Backend/src/modules/prescriptions/prescriptions.service.ts`, `Backend/src/services/ocr/ocr-provider.factory.ts`, `Backend/src/services/ai/ai-provider.factory.ts`
* **Primary services:** Upload, OCR Pipeline, AI Structuring, Manual Verification.
* **Database tables:** `prescriptions`, `prescription_medications`
* **External integrations:** Google Cloud Vision, Gemini (Google AI), Tesseract, Groq, ML Kit (Frontend)

### Medication Tracking
* **Purpose:** Converts verified prescriptions into active medication schedules.
* **Files involved:** `Backend/src/modules/medications/medications.controller.ts`, `Backend/src/modules/medications/medications.routes.ts`
* **Primary services:** Schedule Generation, Dose Logging, Activation.
* **Database tables:** `medication_schedules`, `dose_logs`
* **External integrations:** None

### Refill Monitoring
* **Purpose:** Tracks inventory depletion based on logged doses and projects runout dates.
* **Files involved:** `Backend/src/services/scheduler/...` , `Backend/src/modules/medications/medications.controller.ts`
* **Primary services:** Refill Risk Scanning.
* **Database tables:** `refill_states`
* **External integrations:** None

### Safety Engine
* **Purpose:** Validates extracted medicines against a catalog, detects conflicts/duplicates, and enforces manual verification for high-risk drugs.
* **Files involved:** `Backend/src/utils/medicineSafety.ts`, `Backend/src/utils/medicineTrust.ts`, `Backend/src/utils/medicineIntelligence.ts`, `Backend/src/utils/confidenceEngine.ts`
* **Primary services:** Risk Classification, Trust Profile Generation, Confidence Scoring.
* **Database tables:** Extracted to `trust_metadata` and `continuity_status` fields.
* **External integrations:** CSV Sharded Datasets (`Assets/swasthi_beta_intelligence_v2.csv`)

### Caregiver Coordination
* **Purpose:** Reconciles conflicts when new prescriptions overlap with existing schedules and manages cross-caregiver visibility.
* **Files involved:** `Backend/src/modules/prescriptions/prescriptions.service.ts` (reconcilePrescription)
* **Primary services:** Prescription Reconciliation.
* **Database tables:** `prescriptions`, `prescription_medications`
* **External integrations:** None

### Notifications
* **Purpose:** Sends reminders for due doses, refill alerts, and platform notifications.
* **Files involved:** `Backend/src/modules/notifications/notifications.controller.ts`
* **Primary services:** Alert Dispatching.
* **Database tables:** `alerts`, `notification_tokens`, `notification_preferences`
* **External integrations:** Firebase Cloud Messaging (FCM)

### Analytics
* **Purpose:** Logs critical user actions and system events for observability and product insights.
* **Files involved:** `Backend/src/services/audit.service.ts`, `Frontend/src/lib/analytics.ts`
* **Primary services:** Audit Logging, Edge OCR tracking.
* **Database tables:** `audit_logs`, `usage_tracking`
* **External integrations:** PostHog

### Billing & Subscription
* **Purpose:** Manages subscription plans, beta access, and payments.
* **Files involved:** `Backend/src/modules/subscriptions/subscriptions.routes.ts`, `Backend/src/modules/payments/payments.routes.ts`, `Backend/src/modules/beta/beta.routes.ts`
* **Primary services:** Subscription Assignment, Payment Processing, Beta Invites.
* **Database tables:** `subscription_plans`, `user_subscriptions`, `sanctuary_payments`, `beta_invites`
* **External integrations:** Razorpay

### Infrastructure
* **Purpose:** Core environment configuration, database setup, and scheduling.
* **Files involved:** `Backend/src/app.ts`, `Backend/supabase/migrations/`
* **Primary services:** Node.js Express Server, Postgres migrations.
* **Database tables:** All
* **External integrations:** Supabase

---

# AUTH FLOW

AUTH FLOW
├── Frontend
│   ├── File: `Frontend/src/lib/api.ts`
│   ├── Functions: Unknown (Clerk standard hooks)
│   ├── Inputs: User credentials (email, phone, etc.)
│   └── Outputs: Clerk Token
│
├── Clerk
│   ├── Webhooks: Triggers `user.created`, `user.updated`, `user.deleted`
│   ├── Token Creation: Generates JWT for frontend
│   └── Session Validation: Managed by `@clerk/backend`
│
├── Backend Middleware
│   ├── File: `Backend/src/middleware/auth.ts`
│   ├── Functions: `requireAuth()`, `getBearerToken()`
│   ├── Inputs: Authorization header `Bearer <token>`
│   └── Outputs: `req.auth` with `clerkUserId` and claims
│
├── User Synchronization
│   ├── File: `Backend/src/modules/auth/auth.service.ts`, `Backend/src/modules/auth/auth.controller.ts`
│   ├── Functions: `processClerkWebhook()`, `upsertClerkUser()`, `syncClerkUserHandler()`
│   ├── Inputs: Svix-verified webhook payload or manual sync payload
│   └── Outputs: Inserted/Updated record in local database
│
├── Database
│   ├── Table: `users`
│   ├── Fields: `id`, `clerk_user_id`, `role`, `email`, `phone`, `full_name`
│   └── Outputs: Relational link for RLS (`current_user_id()`)
│
└── Authorization
    ├── File: `Backend/supabase/migrations/...`
    ├── Functions: RLS Policies leveraging `current_user_id()`
    ├── Inputs: Database query
    └── Outputs: Filtered dataset based on user family access

### AUTH EXECUTION FLOW

User Login
↓
Frontend Functions (Clerk SDK)
↓
Clerk Token Generation
↓
Backend Route (`/api/*` protected routes)
↓
Backend Middleware (`requireAuth()`) -> Token Verification
↓
Database (via RLS identifying `clerk_user_id`)
↓
Authenticated Session

---

# OCR FLOW

OCR FLOW
├── Upload Screen
│   ├── File: `Frontend/src/lib/api.ts`
│   ├── Functions: `scanPrescription`
│   ├── Inputs: Prescription Image / File
│   └── Outputs: `FormData` via `XMLHttpRequest`
│
├── Image Processing
│   ├── File: Frontend ML Kit configurations (Edge OCR)
│   ├── Functions: Unknown specific implementation
│   ├── Inputs: Image
│   └── Outputs: Extracted Text (Fallback to Backend if failed)
│
├── API Layer
│   ├── File: `Backend/src/modules/prescriptions/prescriptions.controller.ts`
│   ├── Functions: `scanPrescriptionHandler`, `processPrescriptionHandler`
│   ├── Inputs: Multipart image or `ocrText`/`ocrMetadata`
│   └── Outputs: Orchestration command
│
├── OCR Provider Factory
│   ├── File: `Backend/src/services/ocr/ocr-provider.factory.ts`
│   ├── Functions: Factory resolution to standard interface
│   ├── Inputs: Request payload
│   └── Outputs: Selected OCR Provider
│
├── OCR Providers
│   ├── File: `Backend/src/services/ocr/...`
│   ├── Classes/Functions: Google Vision, Tesseract, ML Kit (edge)
│   ├── Inputs: Image
│   └── Outputs: `extractedText`, `ocrMetadata`
│
├── AI Provider Factory
│   ├── File: `Backend/src/services/ai/ai-provider.factory.ts`
│   ├── Classes/Functions: Gemini, MedGemma
│   ├── Inputs: `extractedText`
│   └── Outputs: AI Parsing Model
│
├── Validation
│   ├── File: `Backend/src/services/ai/validation.ts`
│   ├── Functions: Schema validation (Zod) with recovery logic
│   ├── Inputs: AI raw JSON string
│   └── Outputs: Validated JSON Medication array
│
├── Confidence Engine
│   ├── File: `Backend/src/utils/confidenceEngine.ts`
│   ├── Functions: `computeConfidence()`
│   ├── Inputs: Validated medication
│   └── Outputs: Confidence Score, Risk Flags, Override Verification Level
│
├── Storage
│   ├── File: `Backend/src/modules/prescriptions/prescriptions.service.ts`
│   ├── Functions: DB insertion
│   ├── Inputs: Extracted metadata
│   └── Outputs: Writes to `prescriptions`, `prescription_medications`
│
└── User Response
    ├── Outputs: Draft Medications returned to UI

### OCR EXECUTION FLOW

User Upload
↓
Frontend Functions (`scanPrescription`)
↓
Backend Route (`/api/scan-prescription` or `/api/v2/prescriptions/process`)
↓
OCR Provider (Extract text)
↓
AI Provider (Structure text)
↓
Validation (Zod schema checking)
↓
Confidence Engine (Assign score/flags)
↓
Database (Insert drafts requiring verification)
↓
Response (JSON Drafts)

---

# PRESCRIPTION FLOW

PRESCRIPTION FLOW
├── Upload
│   ├── Files: `Backend/src/modules/prescriptions/prescriptions.routes.ts`, `Frontend/src/lib/api.ts`
│   ├── Functions: `scanPrescriptionUpload` middleware, `scanPrescriptionHandler`
│   ├── Inputs: Image file
│   ├── Outputs: Saved file
│   ├── Writes: Cloud storage
│   └── Reads: None
│
├── OCR Result
│   ├── Files: `Backend/src/services/ocr/...`
│   ├── Functions: Extract text
│   ├── Inputs: Image
│   ├── Outputs: `raw_ocr_text`
│   ├── Writes: None
│   └── Reads: None
│
├── Draft Creation
│   ├── Files: `Backend/src/modules/prescriptions/prescriptions.service.ts`
│   ├── Functions: Insert prescription record
│   ├── Inputs: OCR data, `family_member_id`
│   ├── Outputs: `prescription_id`
│   ├── Writes: `prescriptions`
│   └── Reads: None
│
├── Medicine Extraction
│   ├── Files: `Backend/src/services/ai/...`
│   ├── Functions: AI structured parsing
│   ├── Inputs: `raw_ocr_text`
│   ├── Outputs: Array of structured medications
│   ├── Writes: `prescription_medications` (with `continuity_status = draft`)
│   └── Reads: None
│
├── Verification
│   ├── Files: `Backend/src/modules/prescriptions/prescriptions.service.ts`
│   ├── Functions: `updateParsedMedication`
│   ├── Inputs: User corrections
│   ├── Outputs: Verified medication record
│   ├── Writes: `prescription_medications` (`requires_manual_verification = false`)
│   └── Reads: `prescriptions`
│
├── Reconciliation
│   ├── Files: `Backend/src/modules/prescriptions/prescriptions.service.ts`
│   ├── Functions: `reconcilePrescription`
│   ├── Inputs: Array of actions (`keep_active`, `replace_existing`, `discontinue`)
│   ├── Outputs: Reconciled state array
│   ├── Writes: `prescription_medications`, `medication_schedules`, `prescriptions`
│   └── Reads: `prescription_medications`
│
├── Activation
│   ├── Files: `Backend/src/modules/medications/medications.controller.ts`
│   ├── Functions: `activateMedicationHandler`
│   ├── Inputs: Verified `prescription_medication_id`
│   ├── Outputs: Success confirmation
│   ├── Writes: `prescription_medications` (`continuity_status = active`)
│   └── Reads: `prescription_medications`
│
└── Schedule Creation
    ├── Files: `Backend/src/modules/medications/medications.service.ts` (Assumed based on architecture)
    ├── Functions: Generate schedule entries based on frequency/duration
    ├── Inputs: Activated medication details
    ├── Outputs: Created schedules
    ├── Writes: `medication_schedules`
    └── Reads: None

### Prescription Lifecycle Diagram
Upload Image -> Create Prescription Record -> OCR Parsing -> AI Structuring -> Draft Medication Created -> User Reviews Draft -> Medication Reconciled -> Medication Activated -> Active Schedule Created

---

# MEDICATION FLOW

MEDICATION FLOW
├── Draft Medication
│   ├── Purpose: Holds unverified AI extraction.
│   ├── Files: `Backend/src/modules/prescriptions/prescriptions.service.ts`
│   ├── Functions: Medication insertion logic
│   ├── Database Tables: `prescription_medications`
│   ├── Inputs: AI Output
│   └── Outputs: DB Row (Draft)
│
├── Verification
│   ├── Purpose: User confirms or edits draft data.
│   ├── Files: `Backend/src/modules/prescriptions/prescriptions.service.ts`
│   ├── Functions: `updateParsedMedication`
│   ├── Database Tables: `prescription_medications`
│   ├── Inputs: User form data
│   └── Outputs: DB Row (Verified)
│
├── Safety Checks
│   ├── Purpose: Ensures clinical safety before activation.
│   ├── Files: `Backend/src/utils/medicineTrust.ts`, `Backend/src/utils/medicineSafety.ts`
│   ├── Functions: `detectExcludedMedicine`, `evaluateMedicineRelationships`
│   ├── Database Tables: None
│   ├── Inputs: Medication data
│   └── Outputs: Trust profile, Conflict signals
│
├── Activation
│   ├── Purpose: Moves medication from draft/verified to active.
│   ├── Files: `Backend/src/modules/medications/medications.controller.ts`
│   ├── Functions: `activateMedicationHandler`
│   ├── Database Tables: `prescription_medications`
│   ├── Inputs: `medicationId`
│   └── Outputs: `continuity_status = 'active'`
│
├── Schedule Generation
│   ├── Purpose: Creates actionable reminders based on dosage instructions.
│   ├── Files: `Backend/src/modules/medications/medications.controller.ts` (underlying service)
│   ├── Functions: Unknown
│   ├── Database Tables: `medication_schedules`
│   ├── Inputs: Active medication params
│   └── Outputs: DB Rows (Schedules)
│
├── Reminder System
│   ├── Purpose: Scans for due doses and alerts users.
│   ├── Files: `Backend/src/services/scheduler/...` (Cron jobs)
│   ├── Functions: `scanDueDoseReminders`
│   ├── Database Tables: `alerts`, `notification_tokens`
│   ├── Inputs: Current Time, Schedules
│   └── Outputs: Push Notifications
│
├── Dose Tracking
│   ├── Purpose: Logs user adherence.
│   ├── Files: `Backend/src/modules/medications/medications.controller.ts`
│   ├── Functions: `logDoseHandler`
│   ├── Database Tables: `dose_logs`
│   ├── Inputs: Status (taken/missed/skipped)
│   └── Outputs: DB Row (Log)
│
├── Refill Tracking
│   ├── Purpose: Tracks inventory and alerts on low stock.
│   ├── Files: `Backend/src/modules/medications/medications.controller.ts`
│   ├── Functions: `refillStatusHandler`
│   ├── Database Tables: `refill_states`
│   ├── Inputs: Logged doses
│   └── Outputs: Projected runout date
│
└── Completion
    ├── Purpose: Ends a medication course.
    ├── Files: `Backend/src/modules/prescriptions/prescriptions.service.ts` (reconciliation)
    ├── Functions: Archival or discontinuation
    ├── Database Tables: `medication_schedules`, `prescription_medications`
    ├── Inputs: End date reached or manual stop
    └── Outputs: `status = 'completed'` / `continuity_status = 'discontinued'`

### Medication Lifecycle Diagram
Draft -> Verified -> Safety Checked -> Active -> Scheduled -> Tracked -> Completed / Discontinued

---

# FAMILY FLOW

FAMILY FLOW
├── Family Groups
│   ├── Files: `Backend/src/modules/family/family.controller.ts`
│   ├── Functions: `createFamilyHandler`, `listFamilyHandler`
│   ├── Tables: `family_groups`
│   ├── Inputs: Group Name
│   └── Outputs: Group ID
│
├── Family Members
│   ├── Files: `Backend/src/modules/family/family.controller.ts`
│   ├── Functions: `addFamilyMemberHandler`, `getFamilyMemberHandler`, `updateFamilyMemberHandler`
│   ├── Tables: `family_members`
│   ├── Inputs: Patient Profile (Name, Age, Conditions)
│   └── Outputs: Member ID
│
├── Caregivers
│   ├── Files: `Backend/src/modules/family/family.controller.ts`
│   ├── Functions: `joinFamilyHandler`, `regenerateInviteHandler`
│   ├── Tables: `family_group_memberships`
│   ├── Inputs: Invite Code
│   └── Outputs: Membership Record
│
├── Permissions
│   ├── Files: `Backend/supabase/migrations/...`
│   ├── Functions: `family_group_memberships_role_check`
│   ├── Tables: `family_group_memberships`
│   ├── Inputs: `role` (owner, admin, caregiver, viewer)
│   └── Outputs: Constraints
│
├── Access Control
│   ├── Files: `Backend/supabase/migrations/...`
│   ├── Functions: Postgres RLS logic
│   ├── Tables: All tables
│   ├── Inputs: `current_user_id()`
│   └── Outputs: Data isolation per family
│
└── Dashboard Aggregation
    ├── Files: `Backend/src/modules/dashboard/dashboard.routes.ts`
    ├── Functions: Dashboard data fetch
    ├── Tables: Cross-table joins
    ├── Inputs: `family_member_id`
    └── Outputs: Aggregated views

### Family Data Relationship Diagram

users
↓
family_group_memberships
↓
family_groups
↓
family_members
↓
prescriptions
↓
prescription_medications
↓
medication_schedules

---

# SAFETY ENGINE MAP

├── Confidence Engine
│   ├── Files: `Backend/src/utils/confidenceEngine.ts`
│   ├── Functions: `computeConfidence()`
│   ├── Inputs: `extractedText`, parsed `brand_name`, `strength`, `dosage`
│   ├── Outputs: `ConfidenceScore`, `RiskFlags`, `VerificationLevel`
│   └── Runs: After AI Extraction, before draft saving.
│
├── Medicine Validation
│   ├── Files: `Backend/src/utils/medicineIntelligence.ts`
│   ├── Functions: `findMedicineCatalogMatch()`, `isInsulinOrInjectableDiabetesMedicine()`
│   ├── Inputs: Parsed medication name/strength
│   ├── Outputs: Standardized catalog entry, insulin flag
│   └── Runs: During AI structuring and Validation step.
│
├── Duplicate Detection
│   ├── Files: `Backend/src/utils/medicineTrust.ts`
│   ├── Functions: `evaluateMedicineRelationships()`
│   ├── Inputs: Candidate medication, existing active medications
│   ├── Outputs: Relationship type (duplicate, alternative, compatible)
│   └── Runs: Before Activation / During Reconciliation.
│
├── Interaction Detection
│   ├── Files: `Backend/src/utils/medicineTrust.ts`
│   ├── Functions: `evaluateMedicineRelationships()` (Implicit through molecule-level checks)
│   ├── Inputs: Extracted molecules
│   ├── Outputs: Conflict signals
│   └── Runs: Before Activation.
│
├── Risk Classification
│   ├── Files: `Backend/src/utils/medicineSafety.ts`
│   ├── Functions: `detectExcludedMedicine()`
│   ├── Inputs: Medication data
│   ├── Outputs: `ExcludedMedicineSignal` (e.g., blocks beta usage for high risk)
│   └── Runs: During manual verification/activation.
│
├── Manual Verification Logic
│   ├── Files: `Backend/src/modules/prescriptions/prescriptions.service.ts`
│   ├── Functions: Verification status checks
│   ├── Inputs: `verification_status`, Draft data
│   ├── Outputs: Allowed/Denied action
│   └── Runs: When user attempts to activate a schedule.
│
└── Reconciliation Logic
    ├── Files: `Backend/src/modules/prescriptions/prescriptions.service.ts`
    ├── Functions: `reconcilePrescription()`
    ├── Inputs: Replacement actions
    ├── Outputs: DB state transitions (stopping old schedules)
    └── Runs: Explicit user action when conflicts are detected.

---

# DATABASE MAP

users
├── Purpose: Local representation of Clerk identity.
├── Fields: `id`, `clerk_user_id`, `role`, `beta_access_approved`
├── Relationships: 1:M with `family_group_memberships`, `sanctuary_payments`
├── Referenced By: `family_group_memberships`, `audit_logs`, `sanctuary_payments`
└── Dependencies: None

└── family_groups
    ├── Purpose: Root tenant identifier for data isolation.
    ├── Fields: `id`, `name`
    ├── Relationships: 1:M with `family_members`, `family_group_memberships`
    ├── Referenced By: `family_members`, `family_group_memberships`, `sanctuary_payments`
    └── Dependencies: None

    └── family_group_memberships
        ├── Purpose: Link table for Users to Family Groups with roles.
        ├── Fields: `id`, `user_id`, `family_group_id`, `role`
        ├── Relationships: M:1 with `users`, `family_groups`
        ├── Referenced By: None
        └── Dependencies: `users`, `family_groups`

    └── family_members
        ├── Purpose: The actual patient/dependent.
        ├── Fields: `id`, `family_group_id`, `name`
        ├── Relationships: 1:M with `prescriptions`, `medication_schedules`
        ├── Referenced By: `prescriptions`, `medication_schedules`
        └── Dependencies: `family_groups`

        └── prescriptions
            ├── Purpose: Document record and OCR text state.
            ├── Fields: `id`, `family_member_id`, `image_url`, `archive_status`
            ├── Relationships: 1:M with `prescription_medications`
            ├── Referenced By: `prescription_medications`
            └── Dependencies: `family_members`

            └── prescription_medications
                ├── Purpose: Structured AI extraction output.
                ├── Fields: `id`, `prescription_id`, `medicine_name`, `continuity_status`
                ├── Relationships: 1:M with `medication_schedules`
                ├── Referenced By: `medication_schedules`
                └── Dependencies: `prescriptions`

                └── medication_schedules
                    ├── Purpose: Active reminder timings.
                    ├── Fields: `id`, `prescription_medication_id`, `family_member_id`, `status`
                    ├── Relationships: 1:M with `dose_logs`
                    ├── Referenced By: `dose_logs`
                    └── Dependencies: `prescription_medications`, `family_members`

                    └── dose_logs
                        ├── Purpose: Adherence tracking.
                        ├── Fields: `id`, `medication_schedule_id`, `status` (taken/missed)
                        ├── Relationships: M:1 with `medication_schedules`
                        ├── Referenced By: None
                        └── Dependencies: `medication_schedules`

beta_invites
├── Purpose: Invite codes for early access.
├── Fields: `id`, `code`, `status`, `used_count`
├── Relationships: M:1 with `users` (via `used_by_user_id`)
├── Referenced By: `users`
└── Dependencies: None

sanctuary_payments
├── Purpose: Tracks subscription payments via Razorpay.
├── Fields: `id`, `user_id`, `family_group_id`, `status`, `razorpay_order_id`
├── Relationships: M:1 with `users`, `family_groups`
├── Referenced By: None
└── Dependencies: `users`, `family_groups`

---

# API MAP

### Authentication (`/auth`)
* `POST /auth/sync-clerk-user`
  * **Purpose:** Syncs user profile.
  * **Controller:** `syncClerkUserHandler`
  * **Service:** `upsertClerkUser`
  * **Request:** `syncClerkUserSchema` (JSON)
  * **Response:** User record

* `POST /auth/clerk-webhook`
  * **Purpose:** Webhook receiver.
  * **Controller:** `clerkWebhookHandler`
  * **Service:** `processClerkWebhook`
  * **Request:** Svix-verified JSON
  * **Response:** Processing status

### Family (`/family`)
* `POST /family/create`
  * **Purpose:** Creates new group.
  * **Controller:** `createFamilyHandler`
  * **Service:** Unknown
  * **Request:** `createFamilySchema`
  * **Response:** Group ID

* `POST /family/join`
  * **Purpose:** Joins group via code.
  * **Controller:** `joinFamilyHandler`
  * **Service:** Unknown
  * **Request:** `joinFamilySchema`
  * **Response:** Membership details

* `GET /family/validate-invite/:code`
  * **Purpose:** Validates invite code.
  * **Controller:** `validateInviteHandler`
  * **Service:** Unknown
  * **Request:** Params `code`
  * **Response:** Invite status

* `POST /family/add-member`
  * **Purpose:** Adds patient.
  * **Controller:** `addFamilyMemberHandler`
  * **Service:** Unknown
  * **Request:** `addFamilyMemberSchema`
  * **Response:** Member ID

* `GET /family/list`
  * **Purpose:** Lists family members.
  * **Controller:** `listFamilyHandler`
  * **Service:** Unknown
  * **Request:** None
  * **Response:** Array of members

### Prescriptions (`/prescriptions` & `/api`)
* `POST /prescriptions/upload`
  * **Purpose:** Uploads raw image.
  * **Controller:** `uploadPrescriptionHandler`
  * **Service:** `resolvePrescriptionScanFile`
  * **Request:** Multipart image, `uploadPrescriptionBodySchema`
  * **Response:** Prescription ID

* `POST /prescriptions/decode`
  * **Purpose:** Decodes uploaded image.
  * **Controller:** `decodePrescriptionHandler`
  * **Service:** `decodePrescriptionUpload`
  * **Request:** `decodePrescriptionBodySchema`
  * **Response:** Decoding status

* `POST /api/scan-prescription`
  * **Purpose:** Main OCR ingress.
  * **Controller:** `scanPrescriptionHandler`
  * **Service:** OCR and AI Provider Factories
  * **Request:** Multipart image, `scanPrescriptionBodySchema`
  * **Response:** Parsed draft medications

* `POST /api/v2/prescriptions/process`
  * **Purpose:** Edge OCR ingress.
  * **Controller:** `processPrescriptionHandler`
  * **Service:** `parsePrescription`
  * **Request:** `processPrescriptionSchema`
  * **Response:** Parsed draft medications

* `POST /prescriptions/:id/parse`
  * **Purpose:** Manually trigger parse.
  * **Controller:** `parsePrescriptionHandler`
  * **Service:** `parsePrescription`
  * **Request:** `parsePrescriptionSchema`
  * **Response:** Parsed medications

* `POST /prescriptions/:id/reconcile`
  * **Purpose:** Resolves conflicts.
  * **Controller:** `reconcilePrescriptionHandler`
  * **Service:** `reconcilePrescription`
  * **Request:** `reconcilePrescriptionSchema`
  * **Response:** Reconciliation results

* `PATCH /prescriptions/medications/:medicationId`
  * **Purpose:** Saves verifications.
  * **Controller:** `updateParsedMedicationHandler`
  * **Service:** `updateParsedMedication`
  * **Request:** `updateParsedMedicationSchema`
  * **Response:** Verified medication

### Medications (`/medications`)
* `POST /medications/activate`
  * **Purpose:** Activates medication.
  * **Controller:** `activateMedicationHandler`
  * **Service:** Unknown
  * **Request:** `activateMedicationSchema`
  * **Response:** Activation status

* `GET /medications/schedules`
  * **Purpose:** Lists active schedules.
  * **Controller:** `listSchedulesHandler`
  * **Service:** Unknown
  * **Request:** None
  * **Response:** Array of schedules

* `POST /medications/log-dose`
  * **Purpose:** Logs adherence.
  * **Controller:** `logDoseHandler`
  * **Service:** Unknown
  * **Request:** `doseLogSchema`
  * **Response:** Log confirmation

* `GET /medications/refill-status`
  * **Purpose:** Gets inventory tracking.
  * **Controller:** `refillStatusHandler`
  * **Service:** Unknown
  * **Request:** None
  * **Response:** Refill stats

### Dashboard (`/dashboard`)
* `GET /dashboard/...`
  * **Purpose:** Gets dashboard widgets.
  * **Controller:** Unknown
  * **Service:** Unknown
  * **Request:** None
  * **Response:** Dashboard metrics

### Notifications (`/notifications`)
* `PATCH /notifications/preferences`
  * **Purpose:** Updates push preferences.
  * **Controller:** `updatePreferencesHandler`
  * **Service:** Unknown
  * **Request:** `notificationPreferencesSchema`
  * **Response:** Updated preferences

* `POST /notifications/test-push`
  * **Purpose:** Triggers test alert.
  * **Controller:** `sendTestPushHandler`
  * **Service:** Unknown
  * **Request:** None
  * **Response:** Test status

### Beta & Admin (`/beta`, `/admin`)
* `POST /beta/validate`
  * **Purpose:** Validates beta access.
  * **Controller:** `validateBetaInviteHandler`
  * **Service:** Unknown
  * **Request:** `betaInviteCodeSchema`
  * **Response:** Validation status

* `POST /beta/redeem`
  * **Purpose:** Redeems invite.
  * **Controller:** `redeemBetaInviteHandler`
  * **Service:** Unknown
  * **Request:** `betaInviteCodeSchema`
  * **Response:** Redemption status

* `GET /admin/beta-users`
  * **Purpose:** Lists beta participants.
  * **Controller:** `listBetaUsersHandler`
  * **Service:** Unknown
  * **Request:** None
  * **Response:** Array of users

---

# FILE IMPORTANCE RANKING

**Rank #1**
* **File Path:** `Backend/src/modules/prescriptions/prescriptions.service.ts`
* **Purpose:** Core business logic for prescription management.
* **Why Critical:** Orchestrates the entire lifecycle—upload, parsing, verification, and reconciliation. Contains the complex `reconcilePrescription` and `updateParsedMedication` logic.
* **Subsystem:** Prescription Intelligence

**Rank #2**
* **File Path:** `Backend/src/utils/medicineSafety.ts`
* **Purpose:** High-risk detection logic.
* **Why Critical:** Responsible for detecting excluded medicines and applying beta-phase restrictions to prevent clinical accidents.
* **Subsystem:** Safety Engine

**Rank #3**
* **File Path:** `Backend/src/utils/confidenceEngine.ts`
* **Purpose:** Normalizes confidence scores and assigns risk flags.
* **Why Critical:** Decides whether an AI output can be trusted or if it triggers a mandatory "Manual Verification Required" override.
* **Subsystem:** Safety Engine / OCR Flow

**Rank #4**
* **File Path:** `Backend/src/utils/medicineTrust.ts`
* **Purpose:** Detects duplicates and generates trust profiles.
* **Why Critical:** Protects users from double-dosing through `evaluateMedicineRelationships`.
* **Subsystem:** Safety Engine

**Rank #5**
* **File Path:** `Backend/src/utils/medicineIntelligence.ts`
* **Purpose:** Hooks into the Indian Medicines dataset.
* **Why Critical:** Provides catalog matching, fuzzy searching, and formulation logic.
* **Subsystem:** Safety Engine

**Rank #6**
* **File Path:** `Backend/src/modules/auth/auth.service.ts`
* **Purpose:** Identity synchronization.
* **Why Critical:** If the webhook sync fails, users cannot use the platform because their identity won't be in the Postgres database.
* **Subsystem:** Identity & Authentication

**Rank #7**
* **File Path:** `Frontend/src/lib/api.ts`
* **Purpose:** Frontend network layer.
* **Why Critical:** Manages unique multipart uploads using XHR for the `scanPrescription` function.
* **Subsystem:** OCR Flow

**Rank #8**
* **File Path:** `Backend/supabase/migrations/...`
* **Purpose:** Database definitions.
* **Why Critical:** Enforces Row Level Security (RLS) which guarantees multi-tenant family data isolation.
* **Subsystem:** Infrastructure

**Rank #9**
* **File Path:** `Backend/src/services/ocr/ocr-provider.factory.ts`
* **Purpose:** Abstraction for OCR services.
* **Why Critical:** Enables the switch between Cloud Vision, Tesseract, and Edge implementations.
* **Subsystem:** Prescription Intelligence

**Rank #10**
* **File Path:** `Backend/src/services/ai/ai-provider.factory.ts`
* **Purpose:** Abstraction for AI Reasoning.
* **Why Critical:** Directs text to Gemini or MedGemma for structuring.
* **Subsystem:** Prescription Intelligence

**Rank #11**
* **File Path:** `Backend/src/modules/medications/medications.controller.ts`
* **Purpose:** Medication activation, logging, and schedule listing.
* **Why Critical:** Core entry point for adherence tracking and medication activation.
* **Subsystem:** Medication Tracking

**Rank #12**
* **File Path:** `Backend/src/services/ai/validation.ts`
* **Purpose:** Zod validation schemas for AI outputs.
* **Why Critical:** Ensures all LLM-extracted data conforms to expected formats and prevents malformed data from crashing downstream processes.
* **Subsystem:** Prescription Intelligence

**Rank #13**
* **File Path:** `Backend/src/modules/family/family.controller.ts`
* **Purpose:** Managing family members and caregivers.
* **Why Critical:** Multi-tenant core handling invites and user relationships which define RLS boundaries.
* **Subsystem:** Family Management

**Rank #14**
* **File Path:** `Backend/src/services/scheduler/reminders.ts` (Assumed)
* **Purpose:** Cron jobs for pushing alerts.
* **Why Critical:** Critical for adherence. If this fails, users do not receive reminders to take medicine.
* **Subsystem:** Notifications / Medication Tracking

**Rank #15**
* **File Path:** `Frontend/src/data/indianMedicines.js`
* **Purpose:** Edge medicine catalog dataset.
* **Why Critical:** Frontend logic relies on this for fast searching and autocompleting.
* **Subsystem:** Safety Engine / Frontend

**Rank #16**
* **File Path:** `Backend/src/services/ai/prompts.ts`
* **Purpose:** Contains the clinical reasoning prompts sent to Gemini/MedGemma.
* **Why Critical:** The "brain" of the extraction process, directly dictating hallucination rates and extraction accuracy.
* **Subsystem:** Prescription Intelligence

**Rank #17**
* **File Path:** `Backend/src/modules/prescriptions/prescriptions.controller.ts`
* **Purpose:** API layer for prescription handling.
* **Why Critical:** Orchestrates the endpoints for the entire prescription pipeline.
* **Subsystem:** Prescription Intelligence

**Rank #18**
* **File Path:** `Backend/src/app.ts`
* **Purpose:** Express application setup.
* **Why Critical:** Configures middleware, error handlers, and top-level routing.
* **Subsystem:** Infrastructure

**Rank #19**
* **File Path:** `Backend/src/middleware/auth.ts`
* **Purpose:** Auth verification middleware.
* **Why Critical:** Secures all protected routes by checking Clerk JWT validity.
* **Subsystem:** Identity & Authentication

**Rank #20**
* **File Path:** `Backend/src/services/audit.service.ts`
* **Purpose:** Writing records to `audit_logs`.
* **Why Critical:** Provides observability and trace histories for medical actions.
* **Subsystem:** Analytics

**Rank #21**
* **File Path:** `Backend/src/modules/auth/auth.controller.ts`
* **Purpose:** Webhook controller for Clerk.
* **Why Critical:** Acts as the entrypoint for critical identity syncs.
* **Subsystem:** Identity & Authentication

**Rank #22**
* **File Path:** `Backend/src/middleware/error-handler.ts`
* **Purpose:** Global error handler.
* **Why Critical:** Centralized failure handling and reporting to Sentry.
* **Subsystem:** Infrastructure

**Rank #23**
* **File Path:** `Frontend/src/theme/theme.ts`
* **Purpose:** Global styling definitions.
* **Why Critical:** Centralizes all visual properties ensuring consistency in the Expo app.
* **Subsystem:** Frontend

**Rank #24**
* **File Path:** `Frontend/src/lib/analytics.ts`
* **Purpose:** PostHog tracking wrapper.
* **Why Critical:** Responsible for capturing edge OCR failure/success rates.
* **Subsystem:** Analytics

**Rank #25**
* **File Path:** `Assets/swasthi_beta_intelligence_v2.csv`
* **Purpose:** Master catalog for medicine intelligence.
* **Why Critical:** The primary source of truth for the entire backend safety engine.
* **Subsystem:** Safety Engine

---

# NEW ENGINEER ONBOARDING MAP

1. **What should I learn first?**
   Understand the Data Hierarchy: `User` -> `Family Group` -> `Family Member` -> `Prescription` -> `Prescription Medication` -> `Medication Schedule`. Everything in the app is scoped to a `family_member_id`.

2. **What are the critical workflows?**
   The OCR/AI pipeline (`/api/scan-prescription` & `/api/v2/prescriptions/process`) and the Medication Activation/Reconciliation flow. These handle the core value proposition and safety logic.

3. **Which files should I read first?**
   - `Backend/src/modules/prescriptions/prescriptions.service.ts` (Understand parsing and reconciling).
   - `Backend/src/utils/confidenceEngine.ts` (Understand how we distrust AI output).
   - `Backend/supabase/migrations/...` (Understand the RLS security model).
   - `Frontend/src/lib/api.ts` (Understand how the mobile app communicates with the backend).

4. **Which files are dangerous to modify?**
   - **`medicineSafety.ts` & `medicineTrust.ts`**: Altering duplicate detection or risk rules can lead to clinical alert fatigue or allow dangerous medicine combinations.
   - **Supabase Migrations (RLS Policies)**: Changing `current_user_id()` or access policies can leak sensitive medical data across tenants.
   - **Auth Webhook logic**: Breaking this locks out new users entirely.

5. **How does data move through the system?**
   Image -> Frontend API (`XHR FormData`) -> Backend Router -> OCR Factory -> AI Factory -> Zod Validation -> Draft Database Row -> Manual Frontend Verification -> Active Database Row -> Cron Scheduler -> Notification Alert.

6. **What architectural decisions drive the product?**
   - **Pessimistic AI Trust:** The system defaults to "Manual Verification Required" whenever there is ambiguity. High precision is favored over high recall to avoid alert fatigue.
   - **Edge-First Shift:** The product is moving OCR to the edge (ML Kit) for speed, retaining only the clinical reasoning (MedGemma) on the backend.
   - **Relational Integrity:** Strict Postgres RLS guarantees data safety, pushing authorization logic down to the database layer rather than the application code.

---

# FINAL OUTPUT

## RENOMEDY SYSTEM MAP SUMMARY

**User (Mobile App)**
↓
**Authentication (Clerk & Sync)**
Provides Identity (JWT) -> Synced to `users` via Webhooks.
↓
**Family Layer (`family_groups`, `family_members`)**
Isolates Data -> All subsequent records tie to a `family_member_id`.
↓
**Prescription Layer (Upload -> OCR -> AI Structure)**
Converts Image to `prescriptions` -> Parses to `prescription_medications` (Draft Status).
↓
**Safety Layer (Confidence & Validation)**
Validates against Medicine Catalog -> Applies Risk Flags -> Forces Manual Verification for Drafts.
↓
**Medication Layer (Verification -> Activation -> Scheduling)**
User verifies drafts -> Reconciles Conflicts -> Promotes to `medication_schedules`.
↓
**Reminder Layer (Cron & Delivery)**
Scans Active Schedules -> Calculates Refill Risks -> Sends FCM Push Notifications.
↓
**Analytics Layer**
Audit Logs track critical verifications -> PostHog tracks usage events.

*This document serves as the master architecture reference for the Renomedy system.*
