# Phase 1 Report

## Status

[x] Complete - all items in this phase are done  
[ ] Partial - stopped early  
[ ] Blocked - cannot proceed

## Files Changed

- `Frontend/src/localization/locales/en.json` - Updated onboarding copy from family-first language to caregiver-focused language.
- `Frontend/src/screens/LoginScreen.tsx` - Updated auth screen copy from family-first language to care-focused language.
- `Frontend/src/screens/SplashScreen.tsx` - Updated splash subtitle from family-first language to care-circle language.
- `Frontend/src/screens/PrescriptionHubScreen.tsx` - Updated primary prescription-flow button labels.
- `Backend/src/services/ocr/ocr-provider.ts` - Added internal `foodTiming` field to parsed OCR medication type.
- `Backend/src/services/ocr/groq-prescription-parse.ts` - Updated Groq schema/prompt and mapper to keep `timing` and `foodTiming` separate.
- `Backend/src/modules/prescriptions/prescriptions.service.ts` - Persisted parsed `foodTiming` into `prescription_medications.food_timing`.
- `Backend/tests/groq-prescription-parse.test.js` - Added tests for Groq chat-completion unwrapping and timing/foodTiming separation.
- `Backend/tests/phase0-ocr-accuracy.js` - Updated accuracy scoring to use separated `foodTiming` and correctly score `as needed`.
- `Backend/tests/phase0-artifacts/ocr-phase0-report.md` - Updated generated OCR accuracy report after schema retest.
- `Backend/tests/phase0-artifacts/ocr-phase0-results.json` - Updated machine-readable 50-sample retest results.

## What Was Implemented

Phase 1 copy audit was completed for the required target phrases. Primary/onboarding prescription-flow copy now describes the caregiver managing a person they care for, rather than presenting V1 as a broad family product.

The approved Phase 1 backend condition was also implemented: Groq extraction now asks for and maps `timing` and `foodTiming` as separate fields. `timing` means day timing such as morning/night/bedtime/as needed. `foodTiming` means before food/after food/with food/no food instruction.

## Strings Changed

| File | Old | New |
|---|---|---|
| `Frontend/src/localization/locales/en.json:36` | `Renomedy helps your family never miss a medicine, never misread a prescription.` | `Renomedy helps the person you're caring for never miss a medicine and never misread a prescription.` |
| `Frontend/src/localization/locales/en.json:37` | `Your Family's Private Care Space` | `Your Care Circle's Private Care Space` |
| `Frontend/src/localization/locales/en.json:39` | `Create a new sanctuary for your family or join one that has already been shared with you.` | `Create a new sanctuary for the person you're caring for or join one that has already been shared with you.` |
| `Frontend/src/localization/locales/en.json:56` | `You will get access to your family's shared care space for prescriptions and reminders.` | `You will get access to this shared care space for prescriptions and reminders.` |
| `Frontend/src/localization/locales/en.json:62` | `I manage medicines for my family` | `I manage medicines for someone I care for` |
| `Frontend/src/localization/locales/en.json:64` | `I am joining my family's care space` | `I am joining a shared care space` |
| `Frontend/src/screens/LoginScreen.tsx:149` | `Create your family sanctuary.` | `Create your care sanctuary.` |
| `Frontend/src/screens/LoginScreen.tsx:152` | `Authorized access only. Log in to manage your family's health continuity.` | `Authorized access only. Log in to manage care continuity.` |
| `Frontend/src/screens/SplashScreen.tsx:46` | `Your Family's Private Care Space` | `Your Care Circle's Private Care Space` |
| `Frontend/src/screens/PrescriptionHubScreen.tsx:1120` | `Save To Family Medication List` | `Save To Medication Plan` |
| `Frontend/src/screens/PrescriptionHubScreen.tsx:1131` | `Add Family Member` | `Add a person you're caring for` |

## Strings Left Unchanged

These matched the audit terms but were left unchanged because they are secondary/post-onboarding, pricing, internal/backend, or non-primary marketing surfaces.

- `Frontend/src/screens/PricingScreen.tsx:33` - `Protect Your Family`; pricing surface, not onboarding or primary medicine management.
- `Frontend/src/screens/PricingScreen.tsx:34` - `Protect Your Family`; pricing CTA, not onboarding or primary medicine management.
- `Frontend/src/screens/PricingScreen.tsx:44` - `Up to 3 family members`; pricing plan limit copy, secondary.
- `Frontend/src/screens/PricingScreen.tsx:58` - `Up to 10 family members`; pricing plan limit copy, secondary.
- `Frontend/src/screens/PricingScreen.tsx:184` - `...for your family.`; pricing value copy, secondary.
- `Frontend/src/localization/locales/en.json:88` - `Your Family's Private Care Space`; Family/Sanctuary screen, secondary.
- `Frontend/src/config/renoIt.ts:5` - `Decode your family's prescriptions free`; Reno It/marketing CTA, secondary.
- `Backend/src/modules/*` and `Backend/supabase/*` matches - backend errors, migrations, internal domain names, or subscription metadata; not display copy in primary onboarding/medicine flow.

## Groq Timing/Food Timing Retest

After separating `timing` and `foodTiming`, I reran:

```powershell
node tests/phase0-ocr-accuracy.js --providers=tesseract_groq --limit=50
```

Results:

| Metric | Printed | Handwritten-style | Overall |
|---|---:|---:|---:|
| Total field accuracy | 100.0% | 94.9% | 97.4% |
| Timing accuracy | 100.0% | 100.0% | 100.0% |
| Food timing accuracy | 100.0% | 80.0% | 90.0% |

Remaining common errors:

- `foodTiming`: 5 handwritten-style misses.
- `strength`: 3 handwritten-style misses.
- `frequency`: 1 handwritten-style miss.

Timing is above 75%, so Phase 2 does not need to always-flag timing under the carry-forward rule. Food timing should still be always flagged on handwritten prescriptions.

## Tests Run

- `npm.cmd test` in `Backend` - backend build and test suite, 26/26 tests passed.
- `npm.cmd run typecheck` in `Backend` - TypeScript typecheck passed.
- `npm.cmd run typecheck` in `Frontend` - failed due pre-existing missing modules/types: `@react-navigation/drawer` and `expo-image-picker`, plus downstream implicit-any errors in `AppNavigator.tsx`.
- `node tests/phase0-ocr-accuracy.js --providers=tesseract_groq --limit=50` - 50-sample OCR retest completed, 50/50 parsed.

## Errors or Warnings Encountered

- Frontend typecheck failed - open - dependency/type resolution errors for `@react-navigation/drawer` and `expo-image-picker`; these are not from the Phase 1 copy edits.
- The first timing retest undercounted `as needed` because the harness split it into separate words; fixed in `Backend/tests/phase0-ocr-accuracy.js` and reran the 50-sample benchmark.

## Risks or Concerns

- The OCR accuracy set is synthetic, including handwritten-style synthetic samples; real doctor handwriting may score lower.
- `foodTiming` remains weaker on handwritten-style prescriptions at 80.0%, so Phase 2 should still visibly flag handwritten food timing fields.
- Existing worktree had unrelated modified files before this phase. I did not revert them.

## Decisions Made

- Treated onboarding/auth/splash and prescription upload/processing as primary or onboarding flow and changed matching copy there.
- Treated pricing, profile/settings, Family/Sanctuary management, Reno It marketing, backend errors, and migrations as secondary or internal and left matching copy unchanged.
- Used `Your Care Circle's Private Care Space` as the closest Phase 1 mapping for `Your Family's Private Care Space`.
- Used `Save To Medication Plan` as the closest mapping for `Save To Family Medication List`.

## Blockers for Next Phase

- Frontend typecheck dependency issues should be resolved separately if full frontend validation is required.
- Phase 2 should use rule-based field flagging from the Phase 0/Phase 1 results, not provider confidence as field-level confidence.

## Phase 2 Rule Carry-Forward

- Medicine name: no flag.
- Strength: flag if handwritten.
- Dose: no flag.
- Frequency: no flag.
- Timing: no always-flag needed based on the 100.0% schema retest, but still editable.
- Food timing: always flag on handwritten prescriptions.
- Duration: no flag.
- Do not use provider confidence as field-level confidence.

## Phase Checklist

[x] All items in this phase completed  
[x] No DO NOT TOUCH items were modified  
[x] No features outside this phase's scope were added or changed  
[x] Phase Report is complete and honest

