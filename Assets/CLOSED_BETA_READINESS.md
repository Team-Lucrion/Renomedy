# Renomedy Closed Beta Backend Readiness

## 1. What Is Already Complete

- Supabase schema, RLS, and private `prescriptions` storage bucket exist.
- Existing Edge Functions cover user sync, family creation/join, family member add, prescription upload, OCR save, medication activation, dose logging, and dashboard summary.
- Express API supports Clerk auth, prescription upload/history, medication schedules, notification token registration, dashboard retrieval, and founder-only admin routes.
- Invite-only closed beta gating is enforced before onboarding completion and before family/prescription/medication/notification flows.
- Parsed medications can be manually corrected and verified before schedule activation.
- Refill tracking updates after taken doses and raises refill-risk states.
- Alerts now support dedupe keys, failure reasons, retry/dismiss founder actions, and invalid FCM token cleanup.
- Audit logging exists across onboarding, family actions, upload/parse, medication activation, dose logs, alert failures, and founder actions.
- Build passes and a small automated test suite now covers OCR provider selection (`mock` / `vision_gemini`), golden Gemini parse fixtures, alert dedupe key logic, and refill continuity helpers.

## 2. What Is Missing For Closed Beta

- Real production OCR requires `OCR_PROVIDER=vision_gemini` plus `GEMINI_API_KEY` and Google Vision credentials (`GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_VISION_SERVICE_ACCOUNT_JSON`), with Vision API enabled on the GCP project.
- End-to-end verification against live Supabase, Clerk, Storage, and Firebase credentials still needs to be run in the deployment environment.
- There is still no founder web UI. Founder controls exist as backend endpoints only.
- The automated tests cover critical decision logic, but not full authenticated request/DB integration.

## 3. Exact Schema Changes

- Added migration: [20260506121000_closed_beta_readiness.sql](/C:/Users/Manjunath/Desktop/Rajath/Development/Shared%20Projects/Renomedy/Backend/supabase/migrations/20260506121000_closed_beta_readiness.sql)
- Added migration: [20260506153000_closed_beta_hardening.sql](/C:/Users/Manjunath/Desktop/Rajath/Development/Shared%20Projects/Renomedy/Backend/supabase/migrations/20260506153000_closed_beta_hardening.sql)
- New table: `beta_invites`
  - `invite_code`, `email`, `phone`, `clerk_user_id`, `status`, `approved_by_user_id`, `used_by_user_id`, `expires_at`, `notes`
- `users` additions
  - `beta_access_status`
  - `beta_invite_id`
  - `beta_access_granted_at`
  - `beta_access_revoked_at`
- `prescriptions` additions
  - `ocr_confidence_score`
  - `ocr_provider`
  - `ocr_provider_metadata`
- `prescription_medications` additions
  - `brand_name`
  - `food_timing`
  - `verification_notes`
  - `verified_by_user_id`
  - `verified_at`
  - `is_user_corrected`
  - `last_corrected_at`
- `prescription_uploads` additions
  - `processing_status`
  - `last_error`
  - `last_processed_at`
- `refill_states` additions
  - `daily_depletion`
  - `last_dose_logged_at`
- `alerts` additions / hardening
  - `status`: `pending`, `sent`, `failed`, `dismissed`
  - `dedupe_key`
  - `failure_reason`
  - `failed_at`
  - `dismissed_at`

## 4. Exact Edge Functions To Add Or Update

- Updated
  - `create-family-group`
  - `join-family-group`
  - `add-family-member`
  - `upload-prescription`
  - `save-ocr-parse`
  - `activate-medication-schedule`
  - `log-dose`
  - `get-family-dashboard`
- Shared helper updated
  - `_shared/supabase.ts`
- Express backend updates
  - founder-only `/admin` routes for invite creation, user listing, revoke access, issue inspection, alert retry, alert dismiss
  - `/notifications/test-push`
  - `PATCH /prescriptions/medications/:medicationId`
  - OCR provider factory with `mock` and `http` modes

## 5. Secrets / Env Vars Needed

- Required
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_STORAGE_BUCKET`
  - `CLERK_SECRET_KEY`
  - `CLERK_WEBHOOK_SECRET`
- Required for founder-only admin routes
  - `FOUNDER_CLERK_USER_IDS`
- Required for push delivery
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
- Required for live OCR
  - `OCR_PROVIDER`
  - `OCR_API_URL`
  - `OCR_API_KEY`
- Scheduler
  - `ENABLE_SCHEDULER`
  - `CRON_REMINDER_SCAN`
  - `CRON_REFILL_SCAN`

## 6. Verification Checklist

- `Clerk webhook is public and raw-body verified`
  - `POST /auth/clerk-webhook` must not require Clerk JWT auth
  - Route must stay mounted before `express.json()`
- `Clerk webhook create works`
  - Send a valid `user.created` event and confirm one `users` row exists for that `clerk_user_id`
- `Clerk webhook delete works`
  - Send a valid `user.deleted` event and confirm the mapped `users` row is removed
- `Clerk webhook rejects invalid signatures`
  - Send the same payload with a bad `svix-signature` and expect `400`
- `Clerk webhook replay is safe`
  - Replay the same `user.created` event and confirm no duplicate `users.clerk_user_id` row is created
- `Webhook failures are founder-visible`
  - `GET /admin/issues` should surface `auth.clerk_webhook_failed` and `auth.clerk_webhook_rejected`
- `Uninvited user cannot onboard`
  - `PATCH /users/onboarding` with `onboarding_complete=true` and no valid `invite_code` returns `403`
- `Invited user can onboard`
  - Create invite via `POST /admin/beta-invites`, then complete onboarding with invite code
- `User sync works`
  - Clerk webhook or authenticated `/users/me` provisions user row
- `Family create works`
  - `POST /family` after beta access
- `Family member add works`
  - `POST /family/members`
- `Prescription upload works privately`
  - `POST /prescriptions/upload` returns signed download URL, object stays in private bucket
- `OCR parse save works`
  - `POST /prescriptions/:id/parse` stores raw OCR, meds, confidence, provider metadata, and upload processing state
- `Medication activation requires verification`
  - Activation fails until parsed medication is corrected/verified
- `FCM token registration works`
  - `POST /notifications/register-token`
- `Test push works`
  - `POST /notifications/test-push`
- `Dose log updates refill`
  - `POST /medications/log-dose` with `taken` decrements `quantity_remaining`
- `Dashboard reflects meds/doses/refill`
  - `GET /dashboard`
- `Unauthorized user cannot access another family`
  - Verify RLS with a second Clerk user
- `Audit logs are created`
  - Query `audit_logs` for onboarding, upload, parse, OCR failure, activation, dose log, revoke, notification failures
- `Founder can inspect and act on ops failures`
  - `GET /admin/issues`
  - `POST /admin/alerts/:alertId/retry`
  - `POST /admin/alerts/:alertId/dismiss`

## 7. Launch Blockers

- Apply the two new migrations to the target Supabase project.
- Apply the webhook audit hardening migration so unauthenticated webhook failures can be recorded.
- Set `FOUNDER_CLERK_USER_IDS` in all runtime environments.
- Configure Firebase Admin credentials if push delivery is in launch scope.
- Configure a live OCR endpoint if the beta requires real prescription scanning beyond the mock fallback.
- Run the checklist above against the real deployed environment.

## 8. Deployment Checklist

- Set `CLERK_WEBHOOK_SECRET` in the runtime environment that serves `POST /auth/clerk-webhook`.
- In Clerk, point the webhook endpoint to the deployed `/auth/clerk-webhook` URL.
- Subscribe the Clerk webhook to `user.created` and `user.deleted`. `user.updated` can remain enabled because the backend is idempotent.
- Apply all Supabase migrations, including [20260507130500_webhook_audit_hardening.sql](/C:/Users/Manjunath/Desktop/Rajath/Development/Shared%20Projects/Renomedy/Backend/supabase/migrations/20260507130500_webhook_audit_hardening.sql).
- Confirm `FOUNDER_CLERK_USER_IDS` contains at least one real founder Clerk user id for `/admin/issues`.
- Set valid Firebase Admin credentials and verify `FIREBASE_PROJECT_ID` is a single-line value in the deployed env file or secret manager.
- Keep `OCR_PROVIDER=mock` only if the beta accepts manual prescription entry/verification during validation. Otherwise switch to live OCR before inviting families.

## 9. Trust Blockers

- If `OCR_PROVIDER` remains `mock`, prescription scanning is still demo-grade even though manual verification is enforced.
- There is still no executed full integration test against live credentials in this workspace.
- Founder operations are API-level only, so operational discipline is still needed until a thin internal UI exists.

## 10. Final Closed Beta Backend Readiness Score

- `91/100`

Rationale:

- Strong on access control, private storage, beta gating, human verification, refill continuity, auditability, and operational failure handling.
- Stronger than before because build/test verification now exists and OCR is pluggable for real beta use without product expansion.
- Still short of near-perfect readiness only because live-environment OCR/push/auth verification depends on deployment credentials and real execution outside this workspace.
