# Swasthi — Phase-Gated Codex Implementation Prompt
## Pre-Beta App Improvement Plan
### Derived from: LLM Council Verdict + App Improvement Plan

---

## HOW THIS PROMPT WORKS — READ BEFORE STARTING

This prompt is divided into phases. Each phase is a self-contained unit of work.

**You must complete exactly one phase per session.**

After completing each phase, you must stop and produce a Phase Report before doing anything else. Do not begin the next phase until the human reviews your Phase Report and explicitly says: **"Proceed to Phase [N]."**

If the human does not give that instruction, do not proceed. Wait.

This gate exists because medication management software has safety implications. An unreviewed implementation error in an early phase will compound through every subsequent phase. The gates are not optional. They are the quality control layer.

**If you encounter an ambiguity, a technical blocker, or a decision point not covered by the instructions within a phase:** stop, document it in your Phase Report, and wait for guidance. Do not make assumptions and continue.

---

## CONTEXT FOR CODEX

You are implementing pre-beta improvements to Swasthi (also called Renomedy), an India-first Android app that converts doctor prescriptions into a managed home medication system for families.

The app is NOT a diagnosis tool, pharmacy, or doctor replacement. Its core workflow is:

```
Prescription upload → OCR extraction → User verification → Schedule generation
→ Dose tracking → Refill alerts → Family/caregiver visibility
```

All changes below are derived from a structured strategy review. Every change has a documented reason. Do not skip changes. Do not reorder phases. Do not add features not listed here. Do not touch items in the DO NOT TOUCH section at the end of this document.

---

## DO NOT TOUCH — READ BEFORE ANY PHASE

The following features are excluded from this entire sprint. Do not implement, modify, stub, or add "coming soon" UI for any of them.

| Feature | When to build |
|---|---|
| NRI caregiver feature | V1.5 / early V2 |
| WhatsApp sharing | V2 |
| Hindi / Kannada / Tamil multilingual support | Before public launch, after beta |
| Family circle invitation flow improvements | V2 |
| Prescription archive UI improvements | V2 |
| Chronic care programs | V3 |
| QR / NFC health cards | V3 |
| Emergency health profile | V3 |
| Coming-soon / locked feature UI | Do not add at all |

---

## PHASE REPORT TEMPLATE

After completing each phase, copy this template and fill it in completely. Do not abbreviate. Do not skip sections.

```
## Phase [N] Report

### Status
[ ] Complete — all items in this phase are done
[ ] Partial — stopped early (explain below)
[ ] Blocked — cannot proceed (explain below)

### Files Changed
List every file modified or created. Include the full path and one sentence
describing what changed.

- path/to/file.kt — [what changed]
- path/to/file.xml — [what changed]

### What Was Implemented
A plain-language description of what now works that did not work before.
Be specific. Do not just restate the instructions.

### Tests Run
List every test run. Include: test name, what it tested, result (pass/fail),
and any failure details.

- [test name] — [what it tested] — [PASS / FAIL]

### Errors or Warnings Encountered
List every error, warning, or unexpected behaviour encountered during
implementation. Include how each was resolved or why it remains open.

- [error description] — [resolved / open] — [how resolved or why open]

### Risks or Concerns
Anything that worked but feels fragile, uncertain, or potentially wrong.
Things you implemented but are not confident about. Flag these honestly.

- [risk description]

### Decisions Made
Any decision point not explicitly covered by the instructions, and what
decision you made. These require the human's review before proceeding.

- [decision made and why]

### Blockers for Next Phase
Anything the human must resolve, confirm, or provide before the next phase
can begin.

- [blocker]

### Phase Checklist
[ ] All items in this phase completed
[ ] No DO NOT TOUCH items were modified
[ ] No features outside this phase's scope were added or changed
[ ] Phase Report is complete and honest
```

---
---

# PHASE 0 — OCR ACCURACY TEST

## What this phase is

This is a research and measurement phase. No production code is written. The output is a documented test result that determines how Phases 2 and 3 are implemented.

## Why this phase gates everything else

The OCR/AI extraction layer is the central technical and trust risk in the product. An extraction error on a medicine name or dose that a user fails to catch is both a safety failure and a brand-ending event. The architecture of the input flow — whether OCR is a primary assist or a secondary one — depends entirely on measured accuracy. Do not guess. Do not skip this.

## Instructions

**Step 1 — Assemble the test set**

Collect or synthesise 50 sample Indian prescriptions:
- 25 handwritten prescriptions
- 25 printed / typed prescriptions

If real prescriptions are used, ensure they are anonymised with patient consent. Synthetic samples are acceptable for this test.

**Step 2 — Select candidate OCR backends**

Test at minimum two of the following:
- Google Cloud Vision API (document text detection)
- AWS Textract
- A specialist medical OCR API (research current options)
- Any OCR solution already integrated or under consideration in the codebase

**Step 3 — Run extraction on all 50 prescriptions**

For each prescription, attempt to extract the following fields:
- Medicine name
- Strength (e.g. 500mg)
- Dose (e.g. 1 tablet)
- Frequency (e.g. BD, TDS, OD)
- Timing (e.g. morning, night)
- Food timing (e.g. before food, after food)
- Duration (e.g. 5 days, 1 month)

**Step 4 — Score field-level accuracy**

For each prescription and each field, record:
- Extracted value
- Correct value (ground truth)
- Correct? (Y/N)
- Confidence score from API (if provided)

Calculate:
- Overall field accuracy per backend (printed)
- Overall field accuracy per backend (handwritten)
- Per-field accuracy breakdown (which fields are most error-prone)
- Correlation between API confidence score and actual accuracy (if confidence scores are available)

**Step 5 — Document the results**

Produce a test results document with:
- Table of accuracy scores per backend, split by printed vs. handwritten
- List of the most common error types (wrong medicine name, wrong dose, missing field, etc.)
- Recommendation: which backend to use
- Confidence score threshold recommendation (if applicable)

## Decision gates — these determine Phase 2 and 3 architecture

Based on handwritten prescription accuracy of the chosen backend:

| Handwritten accuracy | Architecture decision |
|---|---|
| Above 75% | OCR presented as equal-weight primary assist alongside manual entry. Confidence flagging required on low-confidence fields. |
| 50–75% | OCR is secondary assist. Manual entry is the visual default. Explicit "handwritten prescription" warning shown. |
| Below 50% | OCR is suppressed for handwritten prescriptions. User prompted to type manually or use a printed prescription. |

Record the architecture decision in the Phase Report. Phase 2 and 3 implementation will follow the decision from this gate.

## Phase 0 stop condition

Stop when the test results document is complete and the architecture decision is recorded. Do not write any production code in this phase.

## Phase 0 Report — required before proceeding

Produce the Phase Report template filled with:
- Which OCR backends were tested
- Accuracy results (printed and handwritten) for each
- The chosen backend
- The architecture decision gate that applies
- Any anomalies or surprises in the results
- The test results document as an attachment or inline

**Wait for human approval before starting Phase 1.**

---
---

# PHASE 1 — COPY AUDIT: REFRAME THE V1 USER

## What this phase is

A codebase-wide copy audit and string replacement. No UI layout changes. No logic changes. Copy and labels only.

## Why this matters

The V1 primary user is a single adult caregiver managing medicines for one elderly parent or dependent. They are not a "family." Every screen that says "your family" in a primary flow sends the wrong signal about who this product is for. This audit must be done before any screen is redesigned, so subsequent phases start with correct language.

## Instructions

**Step 1 — Find all instances**

Search the entire codebase (all layout files, string resources, ViewModel copy, hardcoded strings) for every instance of:
- "your family"
- "family members"
- "family circle"
- "add family"
- "family medicines"
- "family medication"
- "family's"

Record every instance found: file path, line number, current string.

**Step 2 — Apply the decision rule to each instance**

For each instance, answer: *Is this string displayed during onboarding or in the primary medicine management flow (adding medicines, viewing schedule, marking doses, verification)?*

- **YES — primary flow or onboarding:** Replace with caregiver-focused language using the mapping below.
- **NO — settings, profile, post-onboarding features, or secondary screens:** Leave unchanged.

**Replacement mapping:**

| Current string | Replace with |
|---|---|
| "your family's medicines" | "your patient's medicines" |
| "family medicines" | "medicines you're managing" |
| "add family member" | "add a person you're caring for" |
| "your family" (in primary flow) | "the person you're caring for" |
| "family circle" (in primary flow) | "your care circle" |
| "family medication plan" | "medication plan" |
| "family members" (in primary flow) | "people you're caring for" |

If a string doesn't match the table exactly but the meaning is equivalent, apply the closest mapping and note it in your Phase Report under Decisions Made.

**Step 3 — Verify no functional logic was changed**

String replacement only. Confirm:
- No navigation logic was altered
- No data models were changed
- No screen layouts were changed
- Only display strings and labels were modified

## Phase 1 stop condition

Stop when all instances in primary flows are replaced, all instances in secondary flows are confirmed unchanged, and you have verified that no functional logic was touched.

## Phase 1 Report — required before proceeding

Produce the Phase Report template filled with:
- Full list of every string changed (file, line, old value, new value)
- Full list of every string left unchanged and why
- Confirmation that no logic or layout was altered
- Any strings found that were ambiguous (document the decision made)

**Wait for human approval before starting Phase 2.**

---
---

# PHASE 2 — INPUT HIERARCHY: DEMOTE OCR, ELEVATE MANUAL ENTRY

## Dependency

**This phase requires Phase 0 (OCR test) to be complete.** The architecture decision from Phase 0 determines how prominently OCR is presented. Do not implement this phase until the Phase 0 architecture decision is confirmed.

## What this phase is

Restructure the "Add Medicine" entry screen so that OCR and manual entry are equal-weight options. Apply the OCR framing language that signals "starting point, not finished result." Implement OCR confidence flagging.

## Why this matters

An OCR extraction error that a user treats as authoritative — without checking — is the primary safety risk in the product. The fix starts here, before verification: never present extracted data as complete or confirmed.

## Instructions

**A. The Add Medicine screen — equal weight entry options**

Restructure the Add Medicine screen so that both paths are presented as equal primary options:

```
[ Upload Prescription Photo ]     [ Add Medicine Manually ]
       (uses OCR assist)               (type details in)
```

Requirements:
- Both options are primary buttons of equal visual size and weight.
- Neither is a link, small text, secondary CTA, or visually subordinate element.
- The layout must work on screens as narrow as 360dp (common Indian budget Android).
- If the Phase 0 architecture decision was "OCR suppressed for handwritten" or "OCR is secondary assist": the manual entry button must be the first/top option in the layout, with OCR below or clearly labelled as optional.

**B. OCR framing language**

When a user uploads a prescription photo and extraction results are returned, the results screen must use this exact framing:

- Screen header: **"We found these medicines — please check each one"**
- Sub-label on every extracted field: **"Tap to edit if incorrect"**

The following language patterns are prohibited anywhere on this screen:
- ❌ "Your medicines have been extracted"
- ❌ "Here are your medicines"
- ❌ "Extraction complete"
- ❌ "Scan successful"
- ❌ Any language implying the result is final or verified

**C. OCR confidence flagging**

Implement confidence flagging based on the thresholds determined in Phase 0.

For fields where the extraction confidence score is below the threshold:
- Display an amber warning indicator (colour: #F59E0B or your design system's warning amber)
- Warning icon (⚠ or equivalent)
- Field-level label: **"Please verify this field"**

For fields where confidence is above the threshold:
- Display normally
- Field is still editable (no field is ever read-only)

If the entire prescription extraction is low confidence (i.e. likely handwritten and below the Phase 0 threshold):
- Display a banner at the top of the screen: **"This looks like a handwritten prescription. Please check every field carefully."**
- Banner colour: amber background, dark text, not red (red implies error, not caution)

If the OCR backend does not return confidence scores:
- Flag all fields with the "Please verify this field" label
- Document this as a risk in your Phase Report

**D. Nothing else changes in this phase**

Do not touch the verification screen layout. Do not touch manual entry fields. Do not touch onboarding. Those are later phases. This phase is the Add Medicine entry screen and OCR framing only.

## Phase 2 stop condition

Stop when: the Add Medicine screen shows equal-weight options, OCR framing language is applied, and confidence flagging is implemented. No other screens changed.

## Phase 2 Report — required before proceeding

Produce the Phase Report template filled with:
- Confirmation of which Phase 0 architecture decision was applied
- Screenshots or layout descriptions of the new Add Medicine screen
- Confirmation that all prohibited OCR language patterns have been removed
- How confidence flagging was implemented (and whether the backend returns scores)
- Any layout issues on narrow screens (360dp)
- Files changed

**Wait for human approval before starting Phase 3.**

---
---

# PHASE 3 — VERIFICATION SCREEN: FULL REDESIGN

## Dependency

**This phase requires Phase 0 (OCR test) and Phase 2 (input hierarchy) to be complete and approved.**

## What this phase is

A full redesign of the medicine verification screen. This is the most important screen in the app. It is where trust is built or destroyed. It must be designed as an active checking experience, not a confirmation step.

## Why this matters

The verification screen is the last line of defence between an OCR extraction error and a user acting on wrong medication data. If a user successfully catches and corrects one error here, they will trust the app. If they miss an error, the product has failed at its core safety responsibility.

## Instructions

**A. Prescription image accessible in one tap**

The original prescription image must be reachable from the verification screen in one tap, without navigating away.

Implementation options (choose one):
- Persistent floating button labelled **"View Prescription"** that opens the image in a full-screen overlay
- Sticky header with a thumbnail of the prescription that expands on tap
- Split-screen layout (tablet) or toggle button (phone) showing prescription and fields side by side or alternately

Requirements:
- The user must never have to leave the verification screen to consult the original prescription.
- The prescription image must not be hidden behind a settings menu or a separate screen.
- Closing the image overlay returns the user to exactly where they were in verification.

**B. All fields visibly and obviously editable**

Every extracted field must have a clear, visible edit affordance by default. Not on hover. Not on long-press. Visible immediately.

Acceptable affordances:
- Outlined input field
- Underline with edit icon
- Edit pencil icon adjacent to the field value

Unacceptable affordances:
- Static-looking text that requires long-press
- Fields that look like labels
- Edit accessible only through a separate "Edit" button for the whole form

Fields that must be editable on this screen:
- Medicine name
- Strength (e.g. 500mg)
- Dose (e.g. 1 tablet)
- Frequency
- Timing (morning / afternoon / evening / night)
- Food timing (before food / after food / with food)
- Duration
- Start date

**C. Medical abbreviation translation**

No medical abbreviation appears on the verification screen without translation. This is a display transformation: store the abbreviation in the database, show plain text in the UI.

Implement the following mapping as a display utility function:

| Abbreviation | Display as |
|---|---|
| OD | Once daily |
| BD | Twice daily |
| TDS | Three times daily |
| QID | Four times daily |
| SOS | As needed |
| AC | Before food |
| PC | After food |
| HS | At bedtime |
| Stat | Immediately |
| QOD | Every other day |
| QW | Once a week |
| BW | Twice a week |

For any abbreviation not in this list: display the raw abbreviation followed by a **?** icon. Tapping the icon shows a tooltip: **"We're not sure what this means — please check your prescription."**

The translation function must be unit-testable and centralised. Do not inline the mapping in the UI layer.

**D. Guided verification mode**

Implement a guided mode that activates on the user's first verification and is toggleable in settings thereafter.

Guided mode behaviour:
- The screen presents one medicine field at a time.
- For each field: show the field name, the extracted value, and a one-tap shortcut to view the prescription image.
- Ask: **"Does this match your prescription?"**
- Two options: **"Yes, correct"** and **"No, let me fix it"**
- If "No": open the field for editing. After editing, ask again.
- After all fields are confirmed: proceed to activation.

Standard mode (second use onwards, or if guided mode is dismissed):
- Show all fields on one screen in the full-form view.
- All fields editable as per section B above.

First use detection: use a persistent flag (SharedPreferences or equivalent). If the flag is not set, default to guided mode.

**E. Activation: explicit and deliberate**

The activation button — the final action that saves a medicine to the active plan — must:

- Be labelled: **"These details are correct — save this medicine"**
- Have no auto-advance, no swipe-to-confirm, no timer-based proceed
- Be preceded immediately (directly above the button, visible without scrolling) by this instruction line: **"Please confirm the medicine name, dose, and timing match your prescription before saving."**
- This instruction is not a disclaimer. It is not legal text. It is an action prompt. Style it as body text, not footnote text.

**F. No batch activation**

If OCR extracted multiple medicines from one prescription, each medicine must be verified individually before any are activated. There must be no "save all" or "activate all" option.

The flow for multiple medicines: verify medicine 1 → activate medicine 1 → verify medicine 2 → activate medicine 2 → etc.

A progress indicator showing "Medicine 2 of 4" is acceptable and encouraged.

## Phase 3 stop condition

Stop when: prescription image is accessible in one tap, all fields are visibly editable, abbreviation translation is implemented and unit-tested, guided mode works on first use, and activation is explicit with the instruction line above the button.

## Phase 3 Report — required before proceeding

Produce the Phase Report template filled with:
- Description of how prescription image access was implemented (which option was chosen and why)
- Confirmation all fields have visible edit affordances
- Unit test results for the abbreviation translation function
- Guided mode: confirmation it activates on first use and is toggleable in settings
- Confirmation that batch activation is not possible
- Screenshots or layout description of the activation button and instruction line
- Files changed

**Wait for human approval before starting Phase 4.**

---
---

# PHASE 4 — MANUAL ENTRY: FIRST-CLASS FLOW

## What this phase is

Make manual medicine entry complete, fast, and equal to OCR-assisted entry in every respect. Ensure field parity, add medicine name search, implement draft saving, and audit all entry point visibility.

## Why this matters

A significant portion of V1 users will not use OCR. Prescriptions that are too old, too damaged, handwritten beyond OCR capability, or simply preferred to be typed — all of these route through manual entry. It cannot be a fallback. It must work perfectly on its own.

## Instructions

**A. Field parity audit**

Audit the manual entry form against the OCR extraction fields. Confirm that the manual entry form captures every field that OCR extraction captures:

| Field | In OCR flow? | In manual entry form? | Action if missing |
|---|---|---|---|
| Medicine name | ✓ | ? | Add if missing |
| Strength (e.g. 500mg) | ✓ | ? | Add if missing |
| Dose (e.g. 1 tablet) | ✓ | ? | Add if missing |
| Frequency | ✓ | ? | Add if missing |
| Timing (morning/night etc.) | ✓ | ? | Add if missing |
| Food timing | ✓ | ? | Add if missing |
| Duration | ✓ | ? | Add if missing |
| Quantity purchased | ✓ | ? | Add if missing |
| Start date | ✓ | ? | Add if missing |

Fill in the "In manual entry form?" column during your audit. Add any missing fields.

Frequency in the manual entry form must be presented as plain-language options, not abbreviations:
- Once daily
- Twice daily
- Three times daily
- Four times daily
- As needed
- Every other day
- Once a week
- Twice a week
- Other (free text)

**B. Medicine name search**

Add a search-as-you-type input for the medicine name field that searches a bundled list of common Indian medicine names.

Requirements:
- The list must be bundled with the app. It must work offline. No API call required.
- Minimum list size: 200–300 entries covering common Indian primary care medicines in these categories: cardiovascular, diabetes, thyroid, antibiotics, pain/fever, gastro, vitamins/supplements.
- Search matches on both brand name and generic name where both are known.
- Results display: medicine name + strength options (if multiple common strengths exist).
- When a medicine is selected from results: auto-populate the strength field if there is one dominant common strength. If multiple strengths exist, show a strength picker.
- All other fields remain blank for the user to fill.
- If the medicine is not in the list: allow free-text entry. Do not force selection from the list. Do not show an error for unrecognised names.

**C. Draft saving**

If a user begins manual entry and the app is backgrounded, a call comes in, or the user navigates away without saving, auto-save the in-progress entry as a draft.

On returning to the app or navigating back to Add Medicine, show a prompt:
**"You have an unfinished medicine entry for [patient name] — continue?"**

Two options: **"Continue"** and **"Discard and start fresh"**

One draft per patient is sufficient for V1. If a draft exists and the user starts a new entry, the existing draft is discarded after confirmation.

**D. Entry point audit**

Identify every location in the app where a user can initiate adding a medicine. For each entry point, confirm that manual entry and prescription upload are presented with equal visual weight.

If any entry point presents OCR/upload as the primary option with manual entry as a secondary link or small-text option: fix it to equal weight.

## Phase 4 stop condition

Stop when: field parity is confirmed and any missing fields are added, medicine name search works offline, draft saving works across app backgrounding, and all entry points have been audited and corrected.

## Phase 4 Report — required before proceeding

Produce the Phase Report template filled with:
- Field parity audit table (completed, with actions taken for missing fields)
- Medicine name list: source, number of entries, categories covered
- Confirmation that medicine name search works with no network connection
- Draft saving: how it was implemented and how it was tested
- Entry point audit: list of all entry points found and what (if anything) was changed
- Files changed

**Wait for human approval before starting Phase 5.**

---
---

# PHASE 5 — PRESCRIPTION RECONCILIATION: NEW WORKFLOW

## What this phase is

Build a new workflow that does not currently exist: prescription reconciliation when a new prescription is uploaded for a patient who already has active medicines.

## Why this matters

When a patient visits the doctor for a follow-up and receives an updated prescription, the current app has no mechanism to handle this. A family running an old medicine plan while holding a new prescription is a silent safety gap. The old plan and new plan can silently coexist, producing incorrect dose tracking and wrong refill calculations.

## Instructions

**Step 1 — Trigger detection**

When a user initiates adding a new prescription or medicine for a patient, check: does this patient have any currently active medicines?

- If NO active medicines: proceed to the standard add medicine flow. No reconciliation needed.
- If YES active medicines: show the reconciliation interstitial before proceeding.

**Step 2 — Reconciliation interstitial screen**

Show a screen with:

**Header:** "[Patient name] already has active medicines."

**Body:** "Is this a new prescription from a recent doctor visit?"

**Two options:**
- **"Yes — this updates the current plan"** → proceed to reconciliation flow (Step 3)
- **"No — this adds new medicines alongside the existing ones"** → proceed to standard add medicine flow

This screen must not be skippable by back-navigation without making a choice. The user must answer before proceeding.

**Step 3 — Reconciliation view**

After extraction/entry of the new prescription's medicines, show a reconciliation screen.

Layout: a list of medicines with clear grouping:

**Group A — Medicines in both old and new plan**
These are auto-matched by medicine name (fuzzy match, case-insensitive, strip trailing strength).
For each matched pair, show the old values and new values side by side.
User must choose one of:
- **Continue unchanged** — medicine stays active, no changes
- **Update** — medicine continues with new dose/timing (show what changes)
- **Discontinue** — medicine is ending, move to history

**Group B — Medicines only in new prescription (not in old plan)**
For each, show: **"New medicine — not in current plan"**
User action: **"Add to plan"** (will go through verification before activation)

**Group C — Medicines only in old plan (not in new prescription)**
For each, show: **"Not in new prescription"**
User action: **"Discontinue"** or **"Keep active"**
Default: highlight these in amber — they likely need attention.

**Step 4 — Reconciliation confirmation screen**

After all medicines have been actioned, show a summary:

```
Your changes to [patient name]'s medicine plan:

Continuing unchanged: [list]
Updated: [list — old value → new value]
Discontinued: [list]
New medicines to add: [list — these go to verification next]

[ Save these changes ]   [ Go back and review ]
```

"Save these changes" requires one deliberate tap. No auto-advance.

**Step 5 — New medicine verification**

Any medicine marked "Add to plan" must go through the full verification screen (Phase 3) before activation. Do not bypass verification for reconciliation-sourced medicines.

**Step 6 — Archive the superseded prescription**

After reconciliation is confirmed:
- Move the previous prescription to the prescription archive.
- Label it: **"Superseded on [date] — replaced by prescription added [date]"**
- The superseded prescription is never deleted. It is always viewable in the archive.
- Mark its status clearly so users do not confuse it with the active prescription.

## Phase 5 stop condition

Stop when: the trigger detection works correctly, the interstitial screen appears only for patients with active medicines, all three reconciliation groups are handled, the confirmation screen summarises all changes, new medicines go through verification, and superseded prescriptions are archived with correct labelling.

## Phase 5 Report — required before proceeding

Produce the Phase Report template filled with:
- Confirmation of trigger detection logic (which condition fires the interstitial)
- How fuzzy medicine name matching was implemented
- Edge cases tested: patient with zero medicines, patient with one medicine, patient with five or more medicines
- Confirmation that new medicines from reconciliation go through verification
- Confirmation that superseded prescriptions are archived and never deleted
- What happens if the user abandons mid-reconciliation (back button, app backgrounded)
- Files changed

**Wait for human approval before starting Phase 6.**

---
---

# PHASE 6 — ONBOARDING: THREE-STEP FIRST-VALUE FLOW

## What this phase is

Redesign the onboarding sequence so that a new user reaches their first value moment — seeing a patient's medicine and today's dose — within three steps of opening the app for the first time.

## Why this matters

Onboarding drop-off is a product survival question. Every step added before the user sees value loses users who opened the app once and almost stayed. Five or more steps before any value is the current risk. Three is the target.

## Instructions

**The three-step target**

```
Step 1: Account creation
Step 2: Add your first patient
Step 3: Add your first medicine → reach today's dose view
```

After Step 3, the user can see and mark a dose. Onboarding is complete. Every other feature is post-onboarding.

**Step 1 — Account creation**

Screen contains:
- Phone number OR Google sign-in (both options, equal weight)
- Name field
- Nothing else

Do not include on this screen:
- Profile photo
- Date of birth
- Notification permissions prompt
- Terms of service wall (link to terms is acceptable, wall is not)
- Any feature explanation carousel

One tap to proceed after entering name and choosing sign-in method.

**Step 2 — Add your first patient**

Screen contains:
- Prompt: **"Who are you managing medicines for?"**
- Name field
- Relationship picker: Myself / Parent / Spouse / Child / Other

Do not include on this screen:
- Family circle invitation
- Caregiver permissions
- Additional members
- Photo upload

One tap to proceed.

**Step 3 — Add your first medicine**

Screen shows the equal-weight Add Medicine screen from Phase 2:
- Upload Prescription Photo
- Add Medicine Manually

User completes one medicine through the verification screen (Phase 3) and activates it.

App generates the schedule and transitions to today's dose view.

**This is the first value moment.** The user can see a dose and mark it taken. Onboarding is complete.

**Post-onboarding features (accessible from settings or gently prompted after first use week)**

Move these entirely out of the onboarding flow:
- Invite caregivers / family members
- Full profile completion
- Notification preferences
- Additional patients
- Prescription archive walkthrough

**Progress indicator**

Add a simple step counter to every onboarding screen: **"Step 1 of 3"**, **"Step 2 of 3"**, **"Step 3 of 3"**.

**Skip behaviour**

Steps 2 and 3 must offer a **"Skip for now"** option. Tapping Skip takes the user to an empty dashboard with a clear prompt: **"Add a medicine to get started."**

Step 1 (account creation) cannot be skipped — authentication is required.

**Do not change**

Do not change the post-onboarding features themselves. Only move them out of the mandatory onboarding sequence. They must remain accessible.

## Phase 6 stop condition

Stop when: the three-step sequence works end-to-end, the first value moment (dose view after first medicine activation) is reachable in three steps, post-onboarding features are no longer in the mandatory flow, Skip works on Steps 2 and 3, and progress indicators are shown.

## Phase 6 Report — required before proceeding

Produce the Phase Report template filled with:
- Step-by-step description of the new onboarding flow as implemented
- Confirmation that no post-onboarding features appear in the mandatory three steps
- Skip behaviour: what the user sees when they skip Step 2 or Step 3
- First value moment confirmation: what the user sees after completing Step 3
- Any onboarding analytics events added (if applicable) — note what is tracked
- Files changed

**Wait for human approval before starting Phase 7.**

---
---

# PHASE 7 — TRUST AND PRIVACY SIGNALS

## What this phase is

Add four specific trust signals at the moments users need them. These are short, plain-language statements placed inline. They are not legal disclaimers. They are not walls of text. They are human sentences at the right moment.

## Why this matters

The app asks families to upload sensitive medical documents and enter elderly parents' medicine details. For an unknown app, this is a high-trust ask. Doctors and pharmacists evaluating the app for beta will look for evidence that the product has thought about patient safety. These signals provide that evidence at the right moments.

## Instructions

**Signal 1 — Prescription upload screen**

Add one line of text, displayed directly below the upload button, above the keyboard:

> **"Your prescription is stored privately and is only visible to people you invite."**

Requirements:
- Font size: same as body text (minimum 16sp per Phase 8 — implement now to the same standard)
- Not a link. Not a footnote. A visible, readable statement.
- Do not link to the privacy policy from this line.

**Signal 2 — Medicine screens (doctor-respectful note)**

On the medicine detail screen and dose tracking screen, add a dismissable note:

> **"Swasthi helps you manage your prescription. For any medical questions, always consult your doctor."**

Behaviour:
- Appears once per session maximum
- User can dismiss it with an X tap
- After dismissal, does not reappear for 7 days
- Stored in SharedPreferences or equivalent

**Signal 3 — Settings: Your Data section**

Add a section to Settings labelled **"Your Data"** containing:

```
Where is my data stored?
[One accurate sentence about data storage location and provider.]

Who can see my data?
Only you and people you have invited to your care circle.

How do I delete my data?
Tap below to permanently delete your account and all data.
This cannot be undone.

[ Delete my account and all data ]
```

Requirements:
- Fill in the bracketed data storage sentence with accurate information. If data residency is not yet decided: document this as a blocker in your Phase Report and insert a placeholder, but mark it visually (red text or TODO label) so it is not forgotten before beta.
- The delete function must work correctly or be clearly labelled as "not yet active — contact [email]" if not implemented.
- Do not use legalese. Plain sentences only.

**Signal 4 — About Swasthi (beta screen)**

Add a screen accessible from the main menu or settings labelled **"About Swasthi"**. This screen is for beta only and should be easy to remove or archive at public launch.

Contents:
- What the app does (2–3 sentences, plain language)
- What the app does NOT do: diagnose, prescribe, recommend dosage changes, replace doctors (2–3 sentences)
- Who built it and why (1–2 sentences)
- How to give feedback: email address or feedback form link or WhatsApp link
- App version number and build date (auto-populated)

## Phase 7 stop condition

Stop when: prescription upload privacy statement is visible on the upload screen, dismissable doctor-respectful note is implemented on medicine screens, the Your Data settings section is present with accurate (or clearly marked placeholder) data residency info, and the About Swasthi screen is accessible from the main menu.

## Phase 7 Report — required before proceeding

Produce the Phase Report template filled with:
- Confirmation that Signal 1 is visible on the upload screen at the correct position
- Signal 2 dismiss behaviour: how the 7-day suppression is stored and tested
- Signal 3: whether the data residency information is accurate and confirmed, or whether it is a placeholder (if placeholder: this is a blocker for beta)
- Signal 4: screenshot or description of the About Swasthi screen
- Files changed

**Wait for human approval before starting Phase 8.**

---
---

# PHASE 8 — ANDROID POLISH

## What this phase is

Four specific Android quality requirements. These are not aesthetic preferences. They are functional requirements for the target users (caregivers in their 40s–50s, elderly patients, Tier 2/3 city connectivity conditions) and for beta testers evaluating the app on real devices.

## Why this matters

Beta testers are doctors and pharmacists who will evaluate the app on real Android devices in real conditions. An app with illegible text, low contrast, or silent offline failures will not be recommended to patients regardless of the quality of the underlying system.

## Instructions

**A. Typography minimums**

Audit every text element in the app. Enforce these minimum sizes:

| Element type | Minimum size |
|---|---|
| Body text / form labels | 16sp |
| Medicine names | 18sp |
| Dose and strength values | 18sp |
| Schedule times | 18sp |
| Button labels | 16sp |
| Caption / helper / footnote text | 14sp |

Rule: do not use text below 14sp anywhere. If a layout breaks at these sizes, fix the layout. Do not reduce the font size to make the layout fit.

Priority screens for audit (fix these first):
1. Today's dose view
2. Verification screen (Phase 3)
3. Medicine detail screen
4. Onboarding screens (Phase 6)

**B. Contrast — WCAG AA**

Run the app's colour combinations through a contrast checker. Every text-on-background combination must meet:
- Body text: 4.5:1 contrast ratio (WCAG AA)
- Large text and UI components: 3:1 contrast ratio (WCAG AA)

Tool options: Android Accessibility Scanner, Colour Contrast Analyser, or equivalent.

If any screen fails AA on the priority screens listed above: adjust background or text colour values. Do not reduce font size to compensate.

Document every failure found and every fix applied in your Phase Report.

**C. Touch targets — 48x48dp minimum**

Every interactive element must have a minimum touch target of 48x48dp. This is an Android Material Design requirement.

Audit specifically:
- Dose marking buttons (Taken / Missed / Skipped) — highest-frequency interaction in the app
- Edit icons on the verification screen
- Navigation elements (bottom bar, back button, overflow menu)
- Any icon-only buttons
- The dismiss button on the Signal 2 note (Phase 7)

If a visual element is smaller than 48x48dp: add invisible touch padding to bring the target to minimum without changing the visual size.

Document every element that was below minimum and what was done to fix it.

**D. Offline behaviour**

Define and implement clear offline behaviour.

**Must work with no network:**
- Viewing today's dose schedule
- Marking a dose as taken / missed / skipped
- Viewing medicine details
- Viewing prescription archive (use cached data)

**Requires network (graceful failure):**
- Uploading a prescription photo (OCR)
- Syncing dose logs across family members
- Inviting caregivers

**When offline:**
- Show a non-alarming, persistent indicator: **"You're offline — changes will sync when you reconnect."**
- Do not block dose marking because of no connectivity. This is the most important daily action in the app. It must work offline.
- Dose marks made offline must be queued locally and synced automatically when connectivity is restored. Implement a sync queue with conflict resolution (last-write-wins is acceptable for V1).
- Do not show an error on features that require connectivity. Show a clear, calm message: **"This needs an internet connection."**

## Phase 8 stop condition

Stop when: typography minimums are enforced across all priority screens, all priority screens pass WCAG AA contrast, all specified touch targets are at minimum 48x48dp, dose marking works without network connection, and offline sync queue is implemented.

## Phase 8 Report — required before proceeding to final review

Produce the Phase Report template filled with:
- Typography audit: list of every change made (screen, element, old size, new size)
- Contrast audit: list of every failure found and fix applied, with contrast ratios before and after
- Touch target audit: list of every element below minimum and how it was fixed
- Offline behaviour: confirmation that dose marking was tested with no network and works correctly
- Sync queue: how it was implemented and how conflict resolution works
- Files changed

**Wait for human approval before starting Phase 9 (Final Review).**

---
---

# PHASE 9 — BETA READINESS REVIEW

## What this phase is

A complete end-to-end walkthrough of the app from onboarding to prescription reconciliation, using the full beta readiness checklist. No new code is written in this phase. This is verification only.

## Instructions

Walk through the complete flow in order. Test on a real Android device or emulator. Document every step.

```
1. Fresh install — open app for the first time
2. Complete three-step onboarding (Phase 6)
3. Add patient — elderly parent scenario
4. Add medicine via OCR path — upload a prescription photo
5. Walk through verification screen — guided mode (Phase 3)
6. Activate medicine
7. View today's dose schedule
8. Mark a dose as taken
9. Background the app, restore — confirm dose mark persisted
10. Turn off network — mark another dose — confirm it works offline
11. Restore network — confirm offline dose mark synced
12. Add medicine via manual entry path (Phase 4)
13. Begin manual entry, background app, return — confirm draft saved
14. Complete manual entry and activate
15. Upload a second prescription for the same patient — confirm reconciliation interstitial fires (Phase 5)
16. Walk through reconciliation — discontinue one medicine, update one, add one new
17. Confirm superseded prescription is archived correctly
18. View the prescription archive — confirm both prescriptions are present, old one labelled superseded
19. Navigate to Settings → Your Data (Phase 7)
20. Tap About Swasthi (Phase 7)
21. Check every item on the checklist below
```

## Beta Readiness Checklist

Go through every item. Mark each as PASS, FAIL, or NOT TESTED with a note.

**Phase 0 — OCR Test**
- [ ] OCR accuracy test completed and results documented
- [ ] Architecture decision (above 75% / 50–75% / below 50%) recorded and applied

**Phase 1 — Copy**
- [ ] "Your family" replaced with caregiver language in all primary flows
- [ ] Secondary flows (settings, profile) retain original language where appropriate

**Phase 2 — Input Hierarchy**
- [ ] Manual entry and OCR upload are equal-weight options on Add Medicine screen
- [ ] OCR results screen uses approved framing language (no prohibited patterns)
- [ ] OCR confidence flagging is visible on low-confidence fields
- [ ] Handwritten prescription banner appears when applicable

**Phase 3 — Verification Screen**
- [ ] Original prescription accessible in one tap from verification screen
- [ ] All fields visibly and obviously editable on first view
- [ ] All medical abbreviations translated to plain language
- [ ] Unknown abbreviation shows "?" tooltip
- [ ] Guided mode activates on first use
- [ ] Guided mode is toggleable in settings
- [ ] Activation button labelled correctly ("These details are correct — save this medicine")
- [ ] Instruction line appears above activation button
- [ ] No auto-advance or batch activation possible

**Phase 4 — Manual Entry**
- [ ] Manual entry form has full field parity with OCR extraction
- [ ] Frequency shown as plain language options (not abbreviations)
- [ ] Medicine name search works offline
- [ ] Medicine name search returns results for common Indian medicines
- [ ] Unrecognised medicine names accepted as free text without error
- [ ] Draft saving works when app is backgrounded mid-entry
- [ ] Draft restoration prompt appears on return

**Phase 5 — Reconciliation**
- [ ] Reconciliation interstitial fires only when patient has active medicines
- [ ] Interstitial does not fire for patients with no active medicines
- [ ] All three groups (both plans / new only / old only) are shown in reconciliation view
- [ ] New medicines from reconciliation go through verification before activation
- [ ] Superseded prescription is archived with correct "Superseded on [date]" label
- [ ] Superseded prescription is never deleted

**Phase 6 — Onboarding**
- [ ] Onboarding reaches today's dose view in exactly 3 steps
- [ ] No post-onboarding features appear in mandatory flow
- [ ] Progress indicator (Step N of 3) shown on all three steps
- [ ] Skip works on Step 2 and Step 3
- [ ] Skip leads to empty dashboard with "Add a medicine to get started" prompt

**Phase 7 — Trust Signals**
- [ ] Prescription privacy statement visible on upload screen (correct position and size)
- [ ] Doctor-respectful note appears on medicine screens
- [ ] Doctor-respectful note is dismissable
- [ ] Doctor-respectful note does not reappear within 7 days of dismissal
- [ ] Settings → Your Data section present
- [ ] Data residency information is accurate (not a placeholder) — if placeholder: FAIL
- [ ] Delete account function works or is clearly marked as not yet active
- [ ] About Swasthi screen accessible from main menu
- [ ] About Swasthi shows app version and build date

**Phase 8 — Android Polish**
- [ ] All body text is minimum 16sp
- [ ] All medicine names, dose values, schedule times are minimum 18sp
- [ ] No text below 14sp anywhere in the app
- [ ] Today's dose view passes WCAG AA contrast
- [ ] Verification screen passes WCAG AA contrast
- [ ] Medicine detail screen passes WCAG AA contrast
- [ ] Onboarding screens pass WCAG AA contrast
- [ ] Dose marking buttons are minimum 48x48dp touch target
- [ ] All icon-only buttons are minimum 48x48dp touch target
- [ ] Dose marking works with no network connection
- [ ] Offline indicator appears when network is lost
- [ ] Offline dose marks sync when network is restored

**DO NOT TOUCH verification**
- [ ] No NRI caregiver features added
- [ ] No WhatsApp sharing added
- [ ] No multilingual UI added
- [ ] No coming-soon UI added for any excluded feature
- [ ] No V3 features (QR card, emergency profile, chronic care) added or stubbed

## Phase 9 Report — Final

Produce the Phase Report template filled with:
- Checklist above, fully completed with PASS / FAIL / NOT TESTED for every item
- For every FAIL: description of the failure and what needs to be fixed
- For every NOT TESTED: reason it was not tested
- Overall assessment: is the app ready for beta with doctors, pharmacists, and families?
- Recommended next step

**This report is the final deliverable of the implementation sprint.**

---

*End of Swasthi Phase-Gated Codex Implementation Prompt*
*Source: LLM Council Verdict + Pre-Beta App Improvement Plan*
*Scope: Pre-beta changes only. 9 phases. One phase at a time. Human approval required between phases.*
