# Renomedy Master Operating Vault

## 1. Purpose of This File

This file is the single founder operating system for Renomedy.

It is meant to preserve:

- Product architecture
- Backend and frontend system design
- Growth strategy and go-to-market direction
- Testing and validation discipline
- Deployment and runtime setup
- Prompt templates and execution instructions

If prior chat history disappears, this file should still let a founder, CTO, engineer, PM, operator, or growth lead continue execution.

Source-of-truth rule:

- Current codebase is the primary truth for implementation status.
- Existing assets under `Assets/` are supporting strategic context.
- Older architecture notes are historical unless reflected in the code now.

Current repo path:

- `Frontend/` = Expo React Native app
- `Backend/` = Express TypeScript API
- `Assets/` = founder strategy, audits, execution references, design material

Non-goal of this file:

- It does not replace deep product discovery forever.
- It does replace missing memory about what Renomedy is, how it works, and how to keep building it.

---

## 2. Startup Thesis

### 2.1 What Renomedy is

Renomedy is a family medication operating system built on a prescription literacy wedge.

The initial trust wedge is:

- Upload prescription
- Decode and structure medicines clearly
- Verify extracted medicines
- Turn medicine data into family-level tracking, reminders, refill continuity, and premium care coordination

The emotional brand layer is:

- "Sanctuary" = the family's private care space

The backend infrastructure layer is:

- `family_groups`
- `family_group_memberships`
- `family_members`

### 2.2 Core user problem

Families struggle with:

- Misreading handwritten prescriptions
- Tracking medicines across multiple people
- Remembering schedules and refills
- Sharing instructions with caregivers, parents, spouse, or children
- Knowing which instructions are trustworthy vs uncertain OCR

### 2.3 Product wedge

Renomedy is not only a reminder app.
Its wedge is:

1. Prescription clarity
2. Human verification and trust
3. Family coordination
4. Premium medication continuity

### 2.4 Why this matters strategically

Prescription explanation is both:

- Product value
- Trust mechanism
- Viral growth mechanism
- Referral engine
- Conversion bridge into premium family care

### 2.5 Current strategic posture

The repo and `Assets/` context suggest the company is in:

- Closed beta / early launch preparation
- Founder-led validation mode
- Trust-sensitive healthcare execution mode

This means:

- Shipping speed matters
- But trust, access control, and operational discipline matter more

---

## 3. Current Product Surface

## 3.1 Live app areas in code

Frontend screens currently present:

- `LoginScreen`
- `BetaInviteScreen`
- `OnboardingScreen`
- `HomeScreen`
- `PrescriptionHubScreen`
- `TrackerScreen`
- `FamilyScreen`
- `AddFamilyMemberScreen`
- `FamilyMemberDetailsScreen`
- `PricingScreen`
- `ProfileScreen`
- `MedicationActivationScreen`
- `SplashScreen`

Primary user-facing functional domains:

- Authentication with Clerk
- Beta access gate
- Sanctuary creation and joining
- Family member management
- Prescription upload and OCR parsing
- Manual correction and verification
- Medication schedule tracking
- Refill continuity
- Notifications
- Pricing and premium plan UX
- Reno It share-card flow

## 3.2 Current backend domains

Backend Express modules currently include:

- `auth`
- `users`
- `beta`
- `family`
- `prescriptions`
- `medications`
- `dashboard`
- `subscriptions`
- `payments`
- `notifications`
- `admin`

Cross-cutting backend services include:

- OCR provider factory
- Google Vision text extraction
- Gemini prescription parsing
- Clerk current-user provisioning
- Beta access enforcement
- Audit logging
- Notification scheduler
- Firebase push
- Sentry / PostHog observability

## 3.3 Current OCR stack

Current active OCR stack is:

- Google Vision
- Gemini
- `OCR_PROVIDER=vision_gemini`

Legacy FastAPI / Groq OCR has already been deprecated and removed from active code.

## 3.4 Current beta gate

The app now includes a dedicated beta invite system:

- Signed-in users are checked against `users/me`
- If beta access is not approved, user is routed to `BetaInviteScreen`
- Beta approval happens through:
  - `POST /beta/validate`
  - `POST /beta/redeem`

Important architectural separation:

- Beta invite controls app access
- Sanctuary invite controls family entry

These are separate systems and must stay separate.

## 3.5 Current Reno It state

Reno It currently exists as a frontend-first share flow:

- A dedicated share card is rendered in `PrescriptionHubScreen`
- A modal explains the feature
- Native image share is preferred where possible
- Text fallback exists when image sharing is unavailable
- Landing URL is centralized in `Frontend/src/config/renoIt.ts`

---

## 4. Repository Map

## 4.1 Root

- `Frontend/`
- `Backend/`
- `Assets/`
- `prompt.txt` is often used as the active task spec in this workspace

## 4.2 Frontend structure

Important frontend files:

- `Frontend/App.tsx`
- `Frontend/app.json`
- `Frontend/package.json`
- `Frontend/src/navigation/AppNavigator.tsx`
- `Frontend/src/context/AppDataContext.tsx`
- `Frontend/src/lib/api.ts`
- `Frontend/src/lib/clerk.ts`
- `Frontend/src/lib/analytics.ts`
- `Frontend/src/lib/notifications.ts`
- `Frontend/src/theme/theme.ts`
- `Frontend/src/types/backend.ts`

Key screens:

- `Frontend/src/screens/BetaInviteScreen.tsx`
- `Frontend/src/screens/OnboardingScreen.tsx`
- `Frontend/src/screens/FamilyScreen.tsx`
- `Frontend/src/screens/PrescriptionHubScreen.tsx`
- `Frontend/src/screens/TrackerScreen.tsx`
- `Frontend/src/screens/PricingScreen.tsx`
- `Frontend/src/screens/ProfileScreen.tsx`

Key components:

- `Frontend/src/components/RenoItModal.tsx`
- `Frontend/src/components/ConfirmActionModal.tsx`
- `Frontend/src/components/UpgradeModal.tsx`
- `Frontend/src/components/MemberAvatar.tsx`

Config:

- `Frontend/src/config/renoIt.ts`

## 4.3 Backend structure

Important backend files:

- `Backend/src/app.ts`
- `Backend/src/server.ts`
- `Backend/src/config/env.ts`
- `Backend/src/config/logger.ts`
- `Backend/src/config/constants.ts`
- `Backend/src/lib/supabase.ts`
- `Backend/src/lib/sentry.ts`
- `Backend/src/lib/posthog.ts`

Middleware:

- `Backend/src/middleware/auth.ts`
- `Backend/src/middleware/validate.ts`
- `Backend/src/middleware/error-handler.ts`
- `Backend/src/middleware/rate-limit.ts`
- `Backend/src/middleware/request-id.ts`
- `Backend/src/middleware/founder.ts`
- `Backend/src/middleware/observability.ts`

OCR stack:

- `Backend/src/services/ocr/ocr-provider.factory.ts`
- `Backend/src/services/ocr/vision-gemini-ocr.provider.ts`
- `Backend/src/services/ocr/google-vision-text.ts`
- `Backend/src/services/ocr/gemini-prescription-parse.ts`
- `Backend/src/services/ocr/mock-ocr.provider.ts`

Domain modules:

- `Backend/src/modules/auth/*`
- `Backend/src/modules/users/*`
- `Backend/src/modules/beta/*`
- `Backend/src/modules/family/*`
- `Backend/src/modules/prescriptions/*`
- `Backend/src/modules/medications/*`
- `Backend/src/modules/dashboard/*`
- `Backend/src/modules/subscriptions/*`
- `Backend/src/modules/payments/*`
- `Backend/src/modules/notifications/*`
- `Backend/src/modules/admin/*`

Supabase:

- `Backend/supabase/migrations/*`
- `Backend/supabase/functions/*`
- `Backend/supabase/seed.sql`
- `Backend/supabase/config.toml`

Tests:

- `Backend/tests/ocr-provider.factory.test.js`
- `Backend/tests/gemini-prescription-parse.golden.test.js`
- `Backend/tests/alert.utils.test.js`
- `Backend/tests/refill.utils.test.js`
- `Backend/tests/clerk-webhook.test.js`

## 4.4 Strategic assets

The `Assets/` folder contains prior strategic thinking, including:

- closed beta readiness
- GTM plans
- social growth and content systems
- category strategy
- launch audits
- architecture and execution notes

Treat those as advisory operating memory, not runtime truth.

---

## 5. System Architecture

## 5.1 High-level architecture

Renomedy is a mobile-first app with:

- Expo React Native frontend
- Express TypeScript backend
- Supabase database and storage
- Clerk for identity
- Google Vision + Gemini for OCR and prescription parsing
- Firebase for push notifications
- Razorpay-oriented subscription/payment path

### Core flow

1. User authenticates with Clerk
2. Frontend syncs user to backend
3. Backend provisions or updates user record in Supabase
4. Beta access is checked
5. User creates or joins a Sanctuary
6. User uploads a prescription
7. Backend stores image privately in Supabase Storage
8. Backend downloads image bytes and runs OCR/provider parse
9. Parsed medicine rows are stored in `prescription_medications`
10. User verifies or corrects data
11. Medication schedules and reminders drive continuity
12. Premium and sharing features layer on top

## 5.2 Frontend architecture

### App root

`Frontend/App.tsx` composes:

- `ClerkProvider`
- `SafeAreaProvider`
- `AppDataProvider`
- `AppNavigator`

### Navigation model

`AppNavigator.tsx` is the main routing brain.

Current decision logic:

- Not signed in -> `LoginScreen`
- Signed in but not beta approved -> `BetaInviteScreen`
- Signed in and beta approved but onboarding incomplete or no sanctuary -> `OnboardingScreen`
- Signed in, beta approved, and sanctuary exists -> drawer-based `MainTabs`

### Main app tabs/drawer

Drawer screens:

- Dashboard
- Prescriptions
- Medications
- Sanctuary
- Pricing
- Settings

### Data layer

`AppDataContext.tsx` is the frontend application data spine.

It is responsible for:

- syncing Clerk user to backend
- fetching `users/me`
- beta gate state
- family, dashboard, prescription, refill, and subscription hydration
- action methods for:
  - beta activation
  - onboarding completion
  - joining sanctuary
  - leaving sanctuary
  - validating and regenerating invite codes
  - payments
  - notifications
  - family member CRUD
  - dose logging

### API client

`Frontend/src/lib/api.ts` handles:

- Clerk bearer token attachment
- JSON requests
- upload requests via `XMLHttpRequest`
- timeout behavior
- normalized `ApiError`

## 5.3 Backend architecture

### HTTP app

`Backend/src/app.ts` configures:

- `helmet`
- `cors`
- raw Clerk webhook endpoint before `express.json()`
- request ID middleware
- `pino-http`
- rate limiting
- observability middleware
- domain routers
- not-found and error handlers

### Authentication

Auth is based on Clerk JWTs.

Backend pattern:

- `requireAuth` verifies token
- token data is attached to `req.auth`
- `getCurrentUserRecord()` provisions or fetches the Supabase `users` row

### Authorization

Primary access controls:

- Beta gate via `ensureClosedBetaAccess()`
- Sanctuary membership checks
- owner/caregiver checks for write operations
- founder-only routes for admin operations

### Domain module pattern

Each module follows:

- `*.routes.ts`
- `*.controller.ts`
- `*.service.ts`
- `*.schemas.ts`

This is a clean, maintainable backend pattern. Keep future modules consistent.

## 5.4 Data architecture

### Core identity and access

- `users`
- `beta_invites`

### Sanctuary system

- `family_groups`
- `family_group_memberships`
- `family_members`

### Prescription system

- `prescriptions`
- `prescription_uploads`
- `prescription_medications`

### Medication continuity

- `medication_schedules`
- `dose_logs`
- `refill_states`
- `alerts`

### Commercial layer

- `subscription_plans`
- `user_subscriptions`
- sanctuary/payment-related tables from migrations

### Ops and audit

- `audit_logs`
- notification token storage

## 5.5 OCR and parse architecture

### Provider selection

`ocr-provider.factory.ts` currently returns:

- `MockOcrProvider` when `OCR_PROVIDER=mock`
- `VisionGeminiOcrProvider` otherwise

### Real provider flow

`VisionGeminiOcrProvider`:

1. Accepts image bytes
2. Calls Google Vision
3. Normalizes OCR text
4. Sends cleaned text to Gemini parse logic
5. Returns structured medications plus metadata

### Storage and save flow

`prescriptions.service.ts`:

1. Uploads image to private Supabase bucket
2. Creates prescription row
3. Creates upload metadata row
4. Downloads stored image for provider parse
5. Saves OCR output into prescription fields
6. Inserts normalized medication rows
7. Updates processing status
8. Writes audit logs

### Trust model

Critical trust principles already visible in code:

- OCR output is advisory
- Manual verification matters
- Activation of medication schedules requires verification
- UI surfaces confidence and double-check language
- Disclaimers reinforce doctor-first guidance

## 5.6 Notification architecture

There are two layers:

- frontend permission and token registration
- backend token storage and sending logic

Relevant files:

- `Frontend/src/lib/notifications.ts`
- `Backend/src/modules/notifications/*`
- `Backend/src/services/notification/*`
- `Backend/src/services/scheduler/scheduler.service.ts`

### Notification concept

Notifications power:

- medication reminders
- continuity signals
- possibly missed-dose or refill alerts

## 5.7 Payment architecture

Relevant backend files:

- `Backend/src/modules/payments/*`
- `Backend/src/modules/subscriptions/*`

Relevant frontend file:

- `Frontend/src/screens/PricingScreen.tsx`

Current commercial model in code:

- plan-based subscriptions
- payment order creation
- payment verification
- subscription summary fetching

This should be treated as a core monetization spine, not a decorative upsell screen.

## 5.8 Share / virality architecture

Reno It is the current viral or referral-oriented wedge inside the product.

Relevant files:

- `Frontend/src/screens/PrescriptionHubScreen.tsx`
- `Frontend/src/components/RenoItModal.tsx`
- `Frontend/src/config/renoIt.ts`

Current behavior:

- user decodes prescription
- can preview a share card
- can share card image or text fallback
- CTA points to centralized landing URL

Strategic implication:

- Reno It is not just UI polish
- it is part of growth, trust, and family acquisition

---

## 6. Key Product Flows

## 6.1 Authentication and entry

1. User signs up or signs in through Clerk
2. Frontend calls `POST /auth/sync-clerk-user`
3. Frontend calls `GET /users/me`
4. App routes based on beta approval and onboarding state

Failure points:

- broken Clerk config
- backend not reachable
- JWT verification failure
- user not provisioned correctly

## 6.2 Beta invite flow

1. Signed-in user without approval lands on `BetaInviteScreen`
2. Enters code like `RENO-BETA-XXXX`
3. Frontend calls:
   - `POST /beta/validate`
   - `POST /beta/redeem`
4. Backend marks user approved
5. User no longer sees beta gate

Guardrails:

- beta invite is not sanctuary invite
- codes can be invalid, expired, used, or revoked

## 6.3 Sanctuary creation flow

1. User opens onboarding
2. Selects create mode
3. Enters sanctuary name
4. Selects role
5. Backend creates:
   - `family_group`
   - owner membership
   - a primary `family_member` profile
6. `last_sanctuary_id` is stored on the user

## 6.4 Sanctuary join flow

1. User opens onboarding
2. Selects join mode
3. Enters sanctuary invite code
4. Invite is previewed / validated
5. Backend checks:
   - code exists
   - code is not expired
   - user is not already in that sanctuary
   - user is not in another sanctuary
6. Membership and user profile are created

## 6.5 Prescription decode flow

1. User selects camera or gallery image
2. Frontend uploads multipart form data to `api/prescriptions/decode`
3. Backend stores prescription and upload metadata
4. OCR provider parses image
5. Prescription details are returned
6. Frontend renders structured medicine cards
7. User can inspect OCR details, edit medicines, or manually add missing medicines

## 6.6 Medication trust and activation flow

1. Parsed medicine rows exist
2. User reviews confidence and warnings
3. User can edit medicine details or add manual medicine rows
4. Verification status is updated
5. Only then should schedule activation proceed cleanly

## 6.7 Reno It flow

1. Decoded prescription exists
2. Reno It section appears
3. If uncertain meds exist, warning is shown
4. User opens explainer modal
5. In-app share card is rendered
6. Share uses image capture when available, otherwise text fallback

## 6.8 Premium and payment flow

1. User opens Pricing
2. Chooses plan
3. Payment order is created
4. Payment is verified
5. Subscription summary refreshes
6. Premium entitlements unlock

## 6.9 Notification flow

1. Permission is requested at the right product moment
2. Device token is registered
3. Backend stores token
4. Scheduler or event path sends reminder push

---

## 7. Current Known Implementation Truths

## 7.1 What is clearly implemented

- Clerk auth
- backend user sync
- beta gate
- sanctuary create/join/list/member management
- private prescription upload
- Google Vision + Gemini OCR flow
- parsed medication storage
- medication corrections
- dashboard and refill helpers
- pricing surface
- notification registration foundation
- Reno It share UI

## 7.2 What appears partially implemented or needs deeper live validation

- full end-to-end payment behavior in a live environment
- full end-to-end notification delivery in a live environment
- complete production credential validation across Clerk, Supabase, Google, Firebase, payment providers
- integrated founder operations UI
- broader integration test coverage

## 7.3 Strategic code reality

There is some historical strategy drift in the `Assets/` folder.

Examples:

- older notes mention different OCR provider assumptions
- older notes mention auto-approval beta behavior
- newer code has a dedicated beta gate
- newer code has Reno It and a richer trust-oriented prescription UI

Operating rule:

- for product status, trust current code first
- for founder reasoning, use older asset docs as context

---

## 8. GTM Operating Manual

## 8.1 GTM thesis

Renomedy should not market itself as a generic medicine app.

It should be positioned around:

- prescription clarity
- family care coordination
- trust and verification
- premium continuity and medication governance

Short version:

- Trust wedge first
- Family OS second
- Premium upgrade third

## 8.2 ICP and target segments

Primary segments:

- family caregivers managing elderly parents
- spouse-led medication managers
- adult children coordinating medicine adherence remotely
- households with repeated prescription uploads and refill risk

Secondary segments:

- post-discharge family coordination
- chronic disease households
- doctors or pharmacists referring patients for better medicine understanding

## 8.3 Growth wedge

Best GTM wedge:

- decode prescription
- make instructions understandable
- share with family
- invite into Sanctuary

This maps directly to current code.

## 8.4 Channel priorities

Priority 1:

- WhatsApp family sharing
- founder-led onboarding
- doctor / pharmacist referrals
- direct caregiver communities

Priority 2:

- Instagram educational content
- short-form reels explaining medicine confusion and family burden
- local QR or clinic handoff experiments

Priority 3:

- community partnerships
- caregiver groups
- referral loops from active beta users

## 8.5 Messaging hierarchy

### Functional message

"Understand prescriptions clearly. Manage medicines confidently."

### Emotional message

"One calm place for your family's prescriptions, medicines, and reminders."

### Trust message

"Renomedy helps you understand and track. Always follow your doctor's instructions."

### Premium bridge

"Unlock premium care for your whole Sanctuary."

## 8.6 Go-to-market loops

### Loop A: Prescription decode loop

1. User uploads prescription
2. Gets clarity
3. Shares with family
4. Family learns brand
5. New family joins

### Loop B: Caregiver coordination loop

1. One caregiver creates sanctuary
2. Adds members
3. Invites more caregivers or patients
4. Medicine schedules and reminders create stickiness

### Loop C: Professional referral loop

1. Doctor/pharmacist refers patient family
2. Family uploads prescription
3. Trust experience is strong
4. Family refers others

## 8.7 Metrics that matter

### Acquisition

- beta invite redemption rate
- source attribution by invite origin
- landing page to beta application conversion
- clinic / pharmacist referral count

### Activation

- sign up to beta approval
- beta approval to sanctuary creation
- sanctuary creation to first prescription upload
- first upload to verified medication set

### Retention

- 7-day active caregiver rate
- repeat prescription uploads
- active medication schedules per sanctuary
- dose logging consistency

### Revenue

- pricing page views
- order creation rate
- verification success rate
- upgrade conversion by sanctuary type

### Trust

- OCR parse success rate
- manual correction rate
- low-confidence medicine rate
- Reno It share rate
- support tickets around "wrong medicine" or "unclear read"

## 8.8 GTM operating cadence

### Daily

- check beta redemptions
- check new sanctuary creations
- check first prescription uploads
- check broken OCR or failed upload incidents
- review WhatsApp/referral replies

### Weekly

- summarize growth sources
- identify best converting content
- review activation funnel
- review trust blockers and support issues
- identify top beta users for testimonial/referral asks

### Monthly

- decide whether to push acquisition or product trust fixes
- review subscription conversion
- review reminder and refill engagement
- prune failed experiments

## 8.9 Recommended founder dashboard

Track at minimum:

- new signed-in users
- beta approved users
- sanctuary created
- sanctuary joined
- family members added
- prescriptions uploaded
- successful parses
- manual corrections
- medication schedules activated
- premium orders created
- premium payments verified
- notification tokens registered
- Reno It shares

## 8.10 Current GTM constraint

Renomedy must protect trust.

That means:

- do not oversell AI
- do not imply clinical certainty where confidence is low
- do not optimize pure virality at the expense of safety

The product can grow fast only if the trust layer stays intact.

---

## 9. Testing and Validation System

## 9.1 Testing philosophy

Renomedy is a trust-sensitive product.

Testing must prioritize:

- authentication correctness
- access control correctness
- family data isolation
- OCR pipeline stability
- verification safety
- payment integrity
- notification reliability

## 9.2 Current automated tests

Backend test files currently include:

- OCR provider factory selection
- golden Gemini parse fixture mapping
- alert helper logic
- refill helper logic
- Clerk webhook behavior

This is useful but not enough for full launch confidence.

## 9.3 Required test layers

### Layer 1: Static and type validation

Run:

- `npm --prefix Backend run typecheck`
- `npm --prefix Frontend run typecheck`

Use this before and after every meaningful feature change.

### Layer 2: Backend unit tests

Run:

- `npm --prefix Backend test`

Extend coverage for:

- beta invite validation and redeem logic
- family invite validation and expiry
- subscription access rules
- payment verification paths
- notification token flows

### Layer 3: Manual critical path tests

Must always test:

1. Sign up / sign in
2. Beta gate
3. Create sanctuary
4. Join sanctuary
5. Upload prescription
6. OCR parse result render
7. Manual medicine correction
8. Schedule activation
9. Payment order and verification
10. Notification registration
11. Reno It share

## 9.4 Manual validation checklist

### Auth and beta

- Unsigned user sees login
- Signed-in, unapproved user sees beta invite screen
- Invalid beta code fails with exact reason
- Approved user bypasses beta screen next login

### Sanctuary

- New approved user can create sanctuary
- Invite code is visible
- Another approved user can join with valid sanctuary invite
- Expired sanctuary invite fails
- User cannot join multiple sanctuaries

### Prescription

- Upload from gallery works
- Upload from camera works
- OCR provider returns parsed data
- History list refreshes
- Signed image URL works
- Failed OCR displays useful error

### Verification

- Edit existing parsed medicine works
- Add manual medicine works
- Verification status is updated

### Tracking

- Schedules list loads
- Dose logging updates state
- Refill status changes when expected

### Payments

- Pricing screen loads
- Order creation works
- Verification path works
- Subscription summary refreshes

### Notifications

- Token registration works
- Test push works, if enabled
- Reminder flows do not crash

### Reno It

- Reno It appears only after decode
- Warning appears when meds need verification
- Card renders
- Share path opens
- Fallback text includes landing URL

## 9.5 Trust-specific testing

Special attention areas:

- OCR confidence labels must match actual parse state
- low-confidence meds must not look clinically final
- disclaimers must remain visible
- beta and sanctuary invite systems must stay separate

## 9.6 Incident triage testing

When something fails in production-like conditions, ask:

1. Is it auth?
2. Is it beta gate?
3. Is it sanctuary membership?
4. Is it storage upload?
5. Is it OCR provider?
6. Is it schema drift from migrations?
7. Is it payment provider?
8. Is it notification token or Firebase config?

## 9.7 Recommended next test investments

High-value additions:

- integration tests for beta endpoints
- integration tests for family create/join
- a prescription upload and parse smoke test with mock provider
- payment service tests
- notification registration tests

---

## 10. Deployment Operating Manual

## 10.1 Runtime components

You need:

- Frontend Expo app runtime
- Backend Express API runtime
- Supabase project
- Clerk app
- Google Cloud Vision access
- Gemini API access
- Firebase project for push
- Payment provider credentials if premium is in scope

## 10.2 Backend environment

The main backend env example lives at:

- `Backend/.env.example`

Core required backend env groups:

### Infra

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

### Auth

- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `FOUNDER_CLERK_USER_IDS`

### OCR

- `OCR_PROVIDER=vision_gemini`
- `OCR_TIMEOUT_MS`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_VISION_SERVICE_ACCOUNT_JSON`

### Observability

- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_TRACES_SAMPLE_RATE`
- `POSTHOG_ENABLED`
- `POSTHOG_API_KEY`
- `POSTHOG_HOST`

### Notifications

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### Scheduler

- `ENABLE_SCHEDULER`
- `CRON_REMINDER_SCAN`
- `CRON_REFILL_SCAN`

### Payments

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

## 10.3 Frontend environment

Current frontend runtime depends on at least:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_RENO_IT_LANDING_URL` optionally, via centralized Reno It config

## 10.4 Deployment sequence

### Backend deploy sequence

1. Prepare secrets
2. Apply Supabase migrations
3. Deploy backend
4. Validate `/health`
5. Validate Clerk webhook setup
6. Validate `users/me`
7. Validate beta flow
8. Validate OCR path

### Frontend deploy sequence

1. Set Expo public env vars
2. Ensure app scheme and Clerk redirect are aligned
3. Build and run on target devices
4. Validate login, beta gate, and API reachability

## 10.5 Supabase deployment rules

Always:

- apply migrations in order
- never assume local schema matches remote
- validate RLS-sensitive flows with two users when changing sanctuary logic

High-risk schema areas:

- beta invite fields
- family membership roles
- prescription OCR output columns
- subscription and payment schema
- notification token schema

## 10.6 Clerk webhook setup

Backend expects:

- `POST /auth/clerk-webhook`
- raw body verification before JSON parsing

Operational rules:

- webhook route must stay mounted before `express.json()`
- invalid signatures should fail
- replay must remain safe

## 10.7 OCR deployment rules

For live decode:

- use `OCR_PROVIDER=vision_gemini`
- ensure Google Vision API is enabled
- provide either credential path or inline JSON
- ensure Gemini API key is valid

Do not reintroduce legacy OCR providers without a strong reason.

## 10.8 Notification deployment rules

Before enabling reminder UX at scale:

- verify Firebase Admin initialization
- verify token registration
- verify at least one real device receives a test push

## 10.9 Payment deployment rules

Before public launch:

- confirm payment create-order path
- confirm verify path
- confirm webhook signature logic
- confirm subscription summary refresh
- confirm failure fallback UX

## 10.10 Pre-launch checklist

- backend typecheck passes
- frontend typecheck passes
- migrations applied
- Clerk sign in works
- beta gate works
- sanctuary create/join works
- OCR decode works
- manual correction works
- payment happy path works
- notification registration works
- Reno It share works

## 10.11 Post-deploy watchlist

Monitor:

- webhook errors
- OCR timeout rates
- failed uploads
- beta redeem failures
- family join failures
- payment verification failures
- push delivery failures

---

## 11. Development Operating Rules

## 11.1 Code change policy

When changing product code:

- preserve Clerk auth
- preserve current OCR pipeline
- preserve sanctuary backend model
- avoid duplicate invite systems
- avoid duplicate family/sanctuary abstractions
- avoid replacing architecture casually

## 11.2 Safe-change checklist

Before editing:

1. Identify affected flow
2. Identify affected schema
3. Identify affected user state
4. Identify trust implications
5. Identify migration risk

After editing:

1. Typecheck backend
2. Typecheck frontend
3. Run targeted tests
4. Manually validate the critical path

## 11.3 Product trust rules

Never:

- present uncertain OCR as medical fact
- imply the app replaces a doctor
- sacrifice safety copy for conversion

Always:

- surface low confidence clearly
- keep doctor-first disclaimer language
- preserve verification pathways

## 11.4 Scope control rules

Defer aggressively when needed:

- multi-sanctuary complexity
- deep analytics systems
- advanced ownership transfer
- non-core regional expansion
- sophisticated escalation workflows

Build the loop that matters first:

- auth
- beta access
- sanctuary
- prescription clarity
- medication continuity
- payment
- reminder

---

## 12. Known Risks and Technical Debt

## 12.1 Current likely risks

- live OCR credentials may fail despite passing typecheck
- notifications may be partially wired but not fully validated on devices
- payment flow may need live-environment hardening
- test coverage is still light compared to product risk
- founder operations remain mostly API-driven instead of UI-driven

## 12.2 Product risks

- trust loss if OCR output feels too certain
- confusion if beta invite and sanctuary invite messaging overlap
- churn if onboarding asks too much before the first trust moment
- premium conversion weakness if the user does not reach reminder or continuity value

## 12.3 Operational risks

- schema drift between local assumptions and deployed Supabase
- webhook misconfiguration
- stale founder env values
- poor source attribution for growth experiments

---

## 13. Founder Daily and Weekly Operating Playbook

## 13.1 Daily founder loop

Every day, answer:

1. How many new users signed in?
2. How many redeemed beta access?
3. How many created or joined a sanctuary?
4. How many uploaded a prescription?
5. How many successful parses vs failed parses?
6. How many manual corrections happened?
7. How many payment attempts and successes?
8. How many devices registered notifications?
9. How many Reno It shares happened?

## 13.2 Weekly founder review

Every week, review:

- activation funnel
- top acquisition sources
- OCR trust issues
- beta invite usage
- sanctuary collaboration behavior
- premium conversion blockers
- notification retention signals

## 13.3 Product decision rule

If growth is weak but trust is strong:

- improve onboarding, referral, and GTM messaging

If growth is strong but trust is weak:

- stop pushing acquisition until trust issues are fixed

If trust and growth are both weak:

- go back to the wedge: prescription clarity and caregiver pain

---

## 14. Prompt Vault

These prompts are meant to preserve execution quality when using AI coding agents or research assistants.

## 14.1 Master implementation prompt

Use this when asking an implementation agent to continue product work:

```text
Use the current Renomedy codebase as the primary source of truth.

Read:
- Assets/Renomedy_Master_Operating_Vault.md

Your role:
- Continue implementation as an execution engineer
- Do not redesign systems from scratch
- Preserve Clerk auth, current OCR pipeline, Sanctuary architecture, and trust UX

Rules:
- Do not create duplicate Sanctuary/family systems
- Do not reintroduce deprecated OCR providers
- Do not weaken beta gate vs Sanctuary invite separation
- Validate with backend and frontend typecheck after changes

Required output:
- files changed
- migrations added or changed
- validation run
- blockers
- remaining risks
```

## 14.2 Backend feature prompt

```text
Implement the requested backend feature in Renomedy's Express TypeScript API.

Use the existing domain pattern:
- routes
- controller
- service
- schemas

Preserve:
- requireAuth
- ensureClosedBetaAccess
- family membership access controls
- audit logging
- error handling via HttpError

Do not break:
- prescriptions
- subscriptions
- notifications
- OCR provider flow

After implementation:
- run backend typecheck
- summarize files changed, route behavior, schema impact, and risks
```

## 14.3 Frontend feature prompt

```text
Implement the requested frontend feature in Renomedy's Expo React Native app.

Preserve:
- Clerk auth flow
- AppNavigator routing logic
- AppDataContext as the main data spine
- current visual language and trust messaging

Do not break:
- BetaInviteScreen
- OnboardingScreen
- PrescriptionHubScreen
- FamilyScreen
- PricingScreen

After implementation:
- run frontend typecheck
- summarize files changed, UI flow, validation, and limitations
```

## 14.4 OCR safety prompt

```text
Audit or modify Renomedy's prescription OCR flow without breaking the active Vision + Gemini pipeline.

Preserve:
- OCR_PROVIDER=vision_gemini
- Google Vision text extraction
- Gemini parsing
- manual verification and trust disclaimers

Do not:
- reintroduce removed Groq/FastAPI dependencies
- present uncertain OCR as final medical truth
- break PrescriptionHub or Reno It

Required output:
- files changed
- what was preserved
- validation run
- trust risks
```

## 14.5 Beta gate prompt

```text
Work on Renomedy's beta access system only.

Important:
- Beta invite controls app entry
- Sanctuary invite controls family entry
- These systems must stay separate

Preserve:
- POST /beta/validate
- POST /beta/redeem
- BetaInviteScreen routing before onboarding

Do not:
- auto-approve users silently
- merge beta invite with sanctuary invite logic

Validate:
- unapproved user blocked
- valid code approves
- invalid, expired, used, revoked states handled clearly
```

## 14.6 GTM research prompt

```text
Use Renomedy's founder operating vault and current product architecture to generate GTM recommendations.

Focus on:
- caregiver acquisition
- prescription clarity as wedge
- Sanctuary onboarding conversion
- WhatsApp and family sharing loops
- doctor/pharmacist referral loops

Do not suggest generic wellness-app positioning.
Anchor recommendations to:
- trust
- family medication coordination
- prescription understanding
- premium continuity
```

## 14.7 Testing prompt

```text
Design a test plan for Renomedy based on the current codebase.

Cover:
- auth
- beta gate
- sanctuary create/join
- prescription upload and OCR
- manual correction
- medication scheduling
- payments
- notifications
- Reno It

Output:
- automated tests to add
- manual validation checklist
- highest-risk regressions
```

## 14.8 Deployment prompt

```text
Prepare Renomedy for deployment without changing architecture.

Cover:
- backend envs
- frontend envs
- Supabase migrations
- Clerk webhook setup
- Google Vision and Gemini config
- Firebase config
- payment config
- post-deploy validation

Output:
- env checklist
- deployment order
- smoke test steps
- rollback risks
```

---

## 15. Founder Commandments

1. Architecture once, execution many times.
2. Preserve the trust wedge at all costs.
3. Beta access and Sanctuary access are not the same thing.
4. Prescription clarity is the product wedge, not a side feature.
5. Sanctuary is the emotional brand; family tables are the infrastructure.
6. Reno It is growth infrastructure, not decorative UI.
7. Typecheck is mandatory, not optional.
8. Shipping fast is useful only if trust survives.
9. Do not build duplicate systems.
10. Keep this file updated whenever architecture or strategy materially changes.

---

## 16. Recommended Next Updates to This Vault

Update this file whenever any of these changes:

- auth or beta gate logic
- sanctuary data model or role system
- OCR provider or trust UX
- payment entitlements
- notification timing or delivery
- GTM thesis or acquisition channels
- founder operating metrics

Suggested cadence:

- small update after any major feature or migration
- full refresh before launch, fundraising, or hiring

---

## 17. Bottom Line

Renomedy is a trust-first, family medication operating system built on a prescription literacy wedge.

The current codebase already contains the core ingredients:

- auth
- beta gate
- sanctuary model
- OCR and parse pipeline
- verification path
- family coordination
- premium path
- reminder foundation
- share loop

The job now is disciplined continuation:

- keep architecture stable
- strengthen trust
- validate live integrations
- convert the wedge into repeatable growth

If this file is kept current, it can preserve the startup brain even when chat history, team memory, or execution context is fragmented.
