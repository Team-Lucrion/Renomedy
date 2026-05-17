# Renomedy Post Plus Execution Map

## Objective

Execution roadmap if ChatGPT Plus ends and the founder must continue with limited assistance, fragmented context, or lower-bandwidth tooling.

Use:

- current codebase
- `Assets/Renomedy_Master_Operating_Vault.md`

---

## 1. Current Startup State

Renomedy currently has:

- Clerk auth
- beta gate
- Sanctuary create/join system
- Vision + Gemini OCR pipeline
- prescription verification path
- medication tracking foundation
- payment architecture surface
- notification foundation
- Reno It share loop

This is no longer ideation stage.
This is execution, validation, and launch-hardening stage.

---

## 2. Immediate Next Priorities

Priority order:

1. deploy envs correctly
2. validate real OCR
3. validate beta gate and Sanctuary flow
4. validate real-device upload and notifications
5. validate payment path
6. onboard first qualified beta users

---

## 3. Week 1: Env + Deploy + Test

Focus:

- backend envs
- frontend envs
- Supabase migrations
- Clerk webhook
- OCR live validation

Deliverables:

- backend deployed
- frontend connected
- auth working
- beta gate working
- first prescription decode working on real device

---

## 4. Week 2: Blocker Fixes

Focus:

- fix highest-risk auth, OCR, upload, and Sanctuary issues
- fix payment or notification blockers
- clean launch path UX

Rule:

- do not add new features while Critical and High blockers exist

---

## 5. Week 3: First Beta Users

Focus:

- approve and onboard first serious caregivers
- founder-assisted onboarding
- collect first real trust feedback
- monitor first upload and first Reno It share

Target outcomes:

- 10 to 15 high-signal users
- real prescription uploads
- repeat usage evidence

---

## 6. Week 4: Retention + GTM

Focus:

- improve re-engagement
- improve upload-to-reminder-to-share loop
- tighten messaging
- ask for referrals

Target outcomes:

- stronger activation rate
- better first-week retention
- visible acquisition loop through WhatsApp / referrals

---

## 7. What to Build Next

Build next only if core launch loop is stable:

- stronger founder ops visibility
- better growth attribution
- better payment failover UX
- better reminder retention UX
- lightweight internal admin tools

---

## 8. What NOT to Build

Do not build next:

- multi-sanctuary complexity
- deep analytics platform
- ownership transfer unless urgently needed
- advanced escalation logic
- regional language expansion before trust loop is stable
- broad "health superapp" features

---

## 9. Decision Trees

### If trust is weak

- stop scale push
- inspect OCR confidence and user corrections
- reduce ambiguity in UI
- increase manual founder onboarding
- prioritize prescription clarity fixes

### If growth is weak

- inspect lead quality
- push WhatsApp and referral loops
- use doctor/pharmacist pilots
- increase founder-led onboarding
- use Reno It as a family-sharing wedge

### If activation is weak

- inspect beta approval to first upload drop-off
- simplify onboarding language
- guide users to first prescription faster
- follow up manually after code send

### If OCR is weak

- validate Vision credentials
- validate Gemini parse quality
- inspect real prescriptions, not only demo images
- tune around trust labels and manual correction UX

---

## 10. Founder Operating Cadence

### Daily

- check new users
- check beta approvals
- check first uploads
- check failed OCR or upload cases
- follow up with top leads

### Weekly

- review funnel
- review trust objections
- review retention behavior
- review premium interest
- decide one product fix and one growth focus

---

## 11. When Stuck, Do This Next

Use this sequence:

1. open `Assets/Renomedy_Master_Operating_Vault.md`
2. identify the broken or weak flow
3. classify: trust, growth, activation, OCR, payment, notification
4. fix the narrowest blocker on the critical path
5. typecheck backend and frontend
6. rerun manual validation for the affected loop
7. write down what changed

If still stuck:

- stop expanding scope
- go back to the first-user loop:
  - sign in
  - beta approval
  - create/join Sanctuary
  - upload prescription
  - trust output
  - continue usage

That loop is the business.
