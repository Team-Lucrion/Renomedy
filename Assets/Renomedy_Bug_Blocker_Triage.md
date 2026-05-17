# Renomedy Bug Blocker Triage

## Objective

This is the founder war-room triage guide during testing and live beta.

Use it to decide:

- what blocks launch
- what to debug first
- what can be deferred safely

---

## 1. Severity Levels

### Critical

- breaks auth or app entry
- breaks beta gate
- leaks or corrupts family/prescription data
- makes OCR misleading in a dangerous way
- causes payment state corruption
- causes app crash on core user path

Action:

- stop launch immediately

### High

- major feature broken but app still usable
- OCR success rate materially degraded
- Sanctuary join/create unreliable
- payment conversion path broken but no data corruption
- notifications silently failing for all users

Action:

- do not expand beta until fixed

### Medium

- bug affects edge cases or secondary paths
- trust copy is wrong but core behavior still safe
- Reno It share fallback is awkward but functional

Action:

- fix during beta iteration

### Low

- polish issues
- copy errors
- layout issues
- minor analytics gaps

Action:

- log and batch

---

## 2. Auth Blockers

Examples:

- sign in fails
- Clerk callback broken
- `users/me` fails after successful sign in
- webhook not provisioning users

Likely root causes:

- wrong Clerk keys
- broken redirect scheme
- backend auth middleware issue
- webhook secret mismatch

Debug order:

1. check Clerk envs
2. verify frontend scheme
3. verify backend `/auth/sync-clerk-user`
4. verify `GET /users/me`
5. inspect webhook logs

---

## 3. Beta Gate Blockers

Examples:

- unapproved user bypasses gate
- approved user is still blocked
- valid code fails to redeem
- beta invite and Sanctuary invite confused in UI or ops

Likely root causes:

- `beta_access_approved` state mismatch
- migration drift
- frontend route logic drift
- wrong admin-generated code format

Debug order:

1. check `users` row
2. check `beta_invites` row
3. test `/beta/validate`
4. test `/beta/redeem`
5. inspect `AppNavigator` route logic

---

## 4. Sanctuary Blockers

Examples:

- cannot create Sanctuary
- cannot join with valid invite
- expired invite still joins
- second Sanctuary restriction broken

Likely root causes:

- migration mismatch
- membership conflict
- invite expiry logic
- bad family group state

Debug order:

1. inspect `family_groups`
2. inspect `family_group_memberships`
3. validate invite endpoint
4. test with second user

---

## 5. OCR Blockers

Examples:

- upload succeeds but parse fails
- Vision returns no useful text
- Gemini parse empty on clear image
- low-confidence result presented as clean truth

Likely root causes:

- Google credentials invalid
- Vision API disabled
- Gemini key invalid
- OCR timeout too low
- schema mismatch in save path

Debug order:

1. confirm `OCR_PROVIDER=vision_gemini`
2. validate Google Vision credentials
3. validate Gemini key
4. inspect backend logs around parse
5. inspect `prescription_uploads.processing_status`

---

## 6. Upload Blockers

Examples:

- image upload fails
- storage object missing
- signed image URL broken
- camera/gallery behavior broken on device

Likely root causes:

- Supabase storage config
- file permission or Expo issue
- MIME handling issue
- network/base URL issue

Debug order:

1. test backend reachability
2. test storage bucket
3. inspect upload metadata row
4. inspect frontend permissions

---

## 7. Payment Blockers

Examples:

- order creation fails
- payment verify fails
- webhook not updating state
- paid user still sees free plan

Likely root causes:

- wrong Razorpay keys
- signature mismatch
- stale subscription refresh
- environment mismatch between frontend and backend

Debug order:

1. test create-order endpoint
2. inspect verify endpoint response
3. inspect subscription summary
4. inspect payment logs and webhook

---

## 8. Notification Blockers

Examples:

- permission granted but no token stored
- test push never arrives
- reminders not sent
- invalid tokens not cleaned up

Likely root causes:

- Firebase Admin credentials wrong
- device token registration failing
- scheduler disabled
- push payload path broken

Debug order:

1. check permission grant
2. verify token registration request
3. inspect notification token table
4. test push from backend
5. inspect scheduler config

---

## 9. Reno It Blockers

Examples:

- Reno It does not appear after decode
- share card render broken
- share opens nothing
- fallback text missing landing URL

Likely root causes:

- decode state missing
- share module not available on device
- card capture failure
- central config mismatch

Debug order:

1. confirm decoded prescription exists
2. confirm Reno It section renders
3. test modal open
4. test native share
5. test text fallback

---

## 10. Stop Launch Immediately If

- auth is unstable
- beta gate is bypassed or traps approved users
- Sanctuary data crosses user/family boundaries
- OCR is returning misleading medicine output without clear warning
- payment charges users but does not unlock correctly
- app crashes on sign in, onboarding, upload, or decode

---

## 11. Safe to Defer If

- copy is imperfect but trust-safe
- minor styling bugs exist
- one non-core analytics hook is missing
- Reno It visual polish is slightly off but sharing still works
- one low-traffic secondary screen has layout issues

---

## 12. Debug Sequence

Use this order during live incident response:

1. Reproduce
2. Identify affected flow
3. Classify severity
4. Check env/config first
5. Check DB state next
6. Check logs
7. Check frontend route/state logic
8. Apply smallest safe fix
9. Revalidate full critical path

---

## 13. Incident Logging Template

```text
Incident ID:
Date/Time:
Reported By:
Environment:
Severity:
Affected Flow:

User Symptoms:

Reproduction Steps:

Expected Behavior:

Actual Behavior:

Likely Root Cause:

Tables / Endpoints Involved:

Fix Applied:

Validation Performed:

Launch Status:
- Continue
- Pause
- Stop

Follow-up Actions:
```

---

## 14. Founder War-Room Rule

Do not debug five things at once.

For each issue:

- classify
- isolate
- fix
- revalidate

Trust-sensitive bugs always outrank growth bugs.
