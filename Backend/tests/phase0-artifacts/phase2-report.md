## Phase 2 Report

### Status
[x] Complete - all items in this phase are done
[ ] Partial - stopped early (explain below)
[ ] Blocked - cannot proceed (explain below)

### Files Changed
- `C:\Users\Manjunath\Desktop\Rajath\Development\Renomedy\Frontend\src\screens\PrescriptionHubScreen.tsx` - Added equal-weight OCR/manual entry buttons, changed OCR result framing to review-first language, added field-level edit prompts, added amber verification indicators, and added the low-confidence handwritten caution banner.
- `C:\Users\Manjunath\Desktop\Rajath\Development\Renomedy\Backend\tests\phase0-artifacts\phase2-report.md` - Added this Phase 2 implementation report.

### What Was Implemented
The Add Medicine / prescription hub screen now presents two equal primary options at the top of the input flow:

- `Upload Prescription Photo` with the sublabel `uses OCR assist`
- `Add Medicine Manually` with the sublabel `type details in`

The Phase 0 architecture decision applied was the `Above 75%` gate from `Backend/tests/phase0-artifacts/ocr-phase0-report.md`, where `tesseract_groq` measured 94.9% handwritten-style field accuracy. OCR is therefore presented as an equal-weight primary assist alongside manual entry.

OCR result copy now frames extracted data as a draft, not a finished result. The result header uses the required text: `We found these medicines - please check each one`. Every displayed extracted field row has the required sublabel: `Tap to edit if incorrect`. Tapping a field row opens the existing medicine editor for correction.

Amber confidence flagging was implemented on extracted field rows with:

- amber border/background
- warning icon
- field-level label `Please verify this field`

The current backend returns provider-level or medicine-level confidence only, not independent field-level confidence. Because Phase 2 requires conservative behavior when field-level confidence is unavailable, all extracted field rows are flagged for verification. The low-confidence prescription banner is shown when the prescription has `ocr_quality === "low"` or prescription summary confidence below `0.75`, with the required copy: `This looks like a handwritten prescription. Please check every field carefully.`

The layout for the two entry buttons uses a wrapping row with equal flex sizing and a `minWidth` of 144. On screens around 360dp wide, both options can remain equal-weight and wrap instead of becoming a small link or secondary CTA.

The exact prohibited OCR result language patterns named in the Phase 2 prompt were removed from the result screen. A source scan before this report was added found no matches for those result-finality phrases in `Frontend` or `Backend`.

No Phase 3 verification screen redesign was started.

### Tests Run
- `rg -n "Your medicines have been extracted|Here are your medicines|Extraction complete|Scan successful|Clearly Read|Structured medicines are ready|extracted from your prescription" Frontend Backend` - checked for prohibited OCR result language - PASS, no matches.
- `npm.cmd run typecheck` in `Backend` - TypeScript validation for backend code - PASS.
- `npm.cmd run typecheck` in `Frontend` - TypeScript validation for frontend code - FAIL, blocked by existing missing type dependencies listed below.
- `git diff --check -- Frontend/src/screens/PrescriptionHubScreen.tsx` - whitespace/conflict marker check for the changed frontend file - PASS, with only Git's CRLF line-ending warning.

### Errors or Warnings Encountered
- Frontend typecheck failed because `@react-navigation/drawer` is missing or missing type declarations - open - this appears outside the Phase 2 changes and causes downstream implicit `any` errors in `Frontend/src/navigation/AppNavigator.tsx`.
- Frontend typecheck failed because `expo-image-picker` is missing or missing type declarations - open - this pre-existing dependency issue affects both `Frontend/src/screens/AddFamilyMemberScreen.tsx` and `Frontend/src/screens/PrescriptionHubScreen.tsx`.
- Git reported `LF will be replaced by CRLF the next time Git touches it` for `Frontend/src/screens/PrescriptionHubScreen.tsx` - open but non-blocking - no whitespace errors were reported by `git diff --check`.

### Risks or Concerns
- The backend does not expose true field-level OCR confidence. Phase 2 confidence flagging is therefore conservative and flags every displayed OCR field for verification.
- The existing frontend data type stores strength and dose in one `dosage` value for persisted medications. The result screen can display both review rows, but they may show the same value until a later schema/UI pass separates them more cleanly.
- The manual entry option is visually equal-weight, but the current save path still depends on an existing or opened prescription record. Fully independent manual medicine creation appears to belong to Phase 4 based on the phased prompt.
- The handwritten banner depends on existing `ocr_quality` and prescription-level confidence. There is no explicit backend flag that says a prescription is handwritten.

### Decisions Made
- Used `Backend/tests/phase0-artifacts/ocr-phase0-report.md` as the Phase 0 decision artifact and did not use `prompt.txt`, per the latest human instruction.
- Applied the `Above 75%` architecture decision, so OCR and manual entry are equal-weight rather than suppressing or visually demoting OCR.
- Because the current backend lacks field-level confidence, all OCR field rows are flagged with `Please verify this field` instead of incorrectly treating provider-level confidence as field-level confidence.
- Kept the Phase 2 work scoped to `PrescriptionHubScreen.tsx`; no verification screen redesign, onboarding change, archive change, or DO NOT TOUCH item was modified.

### Blockers for Next Phase
- Before Phase 3, the frontend dependency/typecheck issue should be resolved or explicitly accepted as a known environment blocker: `@react-navigation/drawer` and `expo-image-picker` are missing or missing type declarations.
- If true field-level confidence is required before beta, the backend OCR response shape needs to add per-field confidence values.
- Independent manual medicine creation is not complete in Phase 2 and should be handled in Phase 4 as planned.

### Phase Checklist
[x] All items in this phase completed
[x] No DO NOT TOUCH items were modified
[x] No features outside this phase's scope were added or changed
[x] Phase Report is complete and honest
