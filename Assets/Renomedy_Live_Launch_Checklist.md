# Renomedy Live Launch Checklist

## Objective

Operational guide to move Renomedy from current codebase state to live beta launch.

Source of truth:

- current repo code
- `Assets/Renomedy_Master_Operating_Vault.md`

Critical separation:

- Beta invite = app access
- Sanctuary invite = family entry

Do not mix them in ops, messaging, or debugging.

---

## 1. Backend Env Checklist

Set in backend runtime:

### Core infra

- `NODE_ENV`
- `PORT`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

### Clerk

- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `FOUNDER_CLERK_USER_IDS`
- `CLERK_JWT_PUBLIC_KEY` if your runtime depends on it

### OCR

- `OCR_PROVIDER=vision_gemini`
- `OCR_TIMEOUT_MS`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- one of:
  - `GOOGLE_APPLICATION_CREDENTIALS`
  - `GOOGLE_VISION_SERVICE_ACCOUNT_JSON`

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

---

## 2. Frontend Env Checklist

Set in Expo/frontend environment:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_RENO_IT_LANDING_URL` if overriding default landing URL

Confirm:

- Expo `scheme` in `Frontend/app.json` matches Clerk redirect setup
- frontend points to the correct backend base URL for the target environment

---

## 3. Clerk Setup

1. Create or verify Clerk application.
2. Enable Native API.
3. Confirm publishable key is in frontend env.
4. Confirm secret key is in backend env.
5. Configure webhook to backend:
   - `POST /auth/clerk-webhook`
6. Subscribe webhook events at minimum:
   - `user.created`
   - `user.updated`
   - `user.deleted`
7. Verify webhook route is public and signature validation works.
8. Verify founder Clerk user IDs are included in `FOUNDER_CLERK_USER_IDS`.

Launch blocker if:

- sign in works in Clerk UI but backend `users/me` fails
- webhook events do not provision or update users

---

## 4. Supabase Setup + Migration Order

Required order:

1. `20260504143000_init_swasthi_backend.sql`
2. `20260505133000_harden_v1_backend.sql`
3. `20260506121000_closed_beta_readiness.sql`
4. `20260506153000_closed_beta_hardening.sql`
5. `20260507130500_webhook_audit_hardening.sql`
6. `20260511121500_fix_family_membership_rls_recursion.sql`
7. `20260512120000_renomedy_subscriptions.sql`
8. `20260512143000_family_member_management.sql`
9. `20260512170000_prescription_ai_pipeline.sql`
10. `20260515143000_launch_phase1_sanctuary_foundation.sql`
11. `20260515170000_sanctuary_payments.sql`
12. `20260516120000_beta_invite_gate.sql`

After migrations:

- confirm private storage bucket for prescriptions exists
- confirm `users`, `beta_invites`, `family_groups`, `family_group_memberships`, `family_members`, `prescriptions`, `prescription_uploads`, `prescription_medications` all contain expected columns
- confirm no migration drift between local assumptions and deployed DB

---

## 5. Google Vision Setup

1. Enable Google Cloud Vision API on the project.
2. Create service account with Vision access.
3. Use either:
   - file path via `GOOGLE_APPLICATION_CREDENTIALS`
   - inline JSON via `GOOGLE_VISION_SERVICE_ACCOUNT_JSON`
4. Test a real prescription image through backend decode.

Block launch if:

- Vision credentials exist but API is disabled
- OCR returns empty text for all uploads

---

## 6. Gemini Setup

1. Provision `GEMINI_API_KEY`.
2. Keep `GEMINI_MODEL=gemini-2.0-flash` unless explicitly upgrading.
3. Confirm backend can parse cleaned OCR text into medicine JSON.
4. Validate confidence, important notes, and raw OCR fallback behavior.

---

## 7. Firebase Setup

1. Create or verify Firebase project.
2. Set:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
3. Verify backend notification module boots cleanly.
4. Register a device token from a real device.
5. Run test push path if available.

---

## 8. Razorpay Setup

1. Set live or test keys:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET`
2. Verify order creation path.
3. Verify payment verification path.
4. Verify webhook endpoint and signature handling if used in your live path.
5. Confirm subscription summary refreshes after successful payment.

Block launch if:

- payment succeeds in Razorpay but app stays unpaid
- verification flow is inconsistent between frontend and backend

---

## 9. Beta Invite Setup

1. Ensure `20260516120000_beta_invite_gate.sql` is applied.
2. Create founder/admin beta codes through:
   - `POST /admin/beta-invites`
3. Use a naming convention like:
   - `RENO-BETA-CAREGIVER-01`
   - `RENO-BETA-DOCTOR-01`
   - `RENO-BETA-WA-01`
4. Confirm user flow:
   - sign in
   - blocked at `BetaInviteScreen`
   - `POST /beta/validate`
   - `POST /beta/redeem`
   - user proceeds to onboarding

---

## 10. Tally -> WhatsApp -> Beta Code -> App Flow

Recommended funnel:

1. User fills Tally form.
2. Founder reviews lead manually.
3. If approved:
   - generate beta code
   - send WhatsApp onboarding message
4. User installs app / opens app.
5. User signs in with Clerk.
6. User enters beta code.
7. User creates or joins Sanctuary.
8. User uploads first prescription.
9. Founder follows up for trust, support, and activation.

Minimum WhatsApp send contents:

- welcome line
- why they were invited
- beta invite code
- app install/open instructions
- what to do first: create/join Sanctuary and upload first prescription

---

## 11. Backend Deploy Order

1. Set all backend env vars.
2. Apply all Supabase migrations.
3. Deploy backend API.
4. Check `/health`.
5. Validate webhook route.
6. Validate `POST /auth/sync-clerk-user`.
7. Validate `GET /users/me`.
8. Validate beta endpoints.
9. Validate family endpoints.
10. Validate prescription decode path.
11. Validate payments.
12. Validate notifications.

---

## 12. Frontend Deploy Order

1. Set frontend env vars.
2. Confirm Clerk redirect scheme.
3. Start/build app for target environment.
4. Validate sign in.
5. Validate beta gate.
6. Validate onboarding.
7. Validate main drawer navigation.
8. Validate prescription upload from a real device.
9. Validate pricing and payment flow.
10. Validate Reno It share behavior.

---

## 13. Real-Device Validation Order

Run on at least one Android and one iPhone if launch scope requires both.

Validation order:

1. Sign up / sign in
2. Beta code redeem
3. Create Sanctuary
4. Join Sanctuary with second user
5. Upload prescription
6. OCR parse result render
7. Manual edit and verification
8. Medication schedule behavior
9. Notification permission and token registration
10. Payment flow
11. Reno It share

---

## 14. OCR Live Validation

Validate:

- image upload succeeds
- private storage object is created
- signed URL is returned
- Vision reads text
- Gemini returns medicine structure
- low-confidence cases show warning language
- parse failures show useful user-facing message

Must test:

- clean prescription image
- noisy handwritten image
- image with at least one ambiguous medicine

---

## 15. Payment Live Validation

Validate:

- pricing screen loads plans
- order creation succeeds
- payment verify path succeeds
- subscription summary updates
- premium UX reflects active state
- failed payment path does not corrupt user state

---

## 16. Notification Live Validation

Validate:

- permission prompt timing feels correct
- token registration succeeds
- backend stores token
- test push arrives
- reminder notification opens correct part of app

---

## 17. Reno It Live Validation

Validate:

- visible only after decoded prescription exists
- verification warning appears when needed
- explainer modal shows correctly
- card renders with trust disclaimer
- image share works where supported
- fallback text includes landing URL
- landing CTA resolves correctly

---

## 18. Go / No-Go Checklist

### Go only if all are true

- auth works
- beta gate works
- Sanctuary create/join works
- OCR works on real prescriptions
- manual correction works
- payment path works or is intentionally disabled
- notifications work or are intentionally deferred
- Reno It works
- no Critical blockers open

### No-Go if any are true

- users cannot sign in reliably
- beta approval is broken
- Sanctuary join/create breaks
- OCR fails on most real images
- payment state is inconsistent
- prescription data leaks across families

---

## 19. Emergency Rollback Priorities

Priority 1:

- preserve auth
- preserve beta gate
- preserve Sanctuary access integrity

Priority 2:

- disable payments if inconsistent
- disable Reno It if share path is causing crashes
- temporarily use `OCR_PROVIDER=mock` only for internal debugging, not public trust-facing launch

Priority 3:

- pause notifications if push errors spam users

Rollback rule:

- remove the failing surface from launch scope before touching core trust flows

---

## 20. Final Launch Decision

Launch only if the first user journey works end-to-end:

- gets approved
- enters app
- creates or joins Sanctuary
- uploads prescription
- understands output
- trusts the result enough to continue
- can share or invite family

If that loop fails, launch is premature.
