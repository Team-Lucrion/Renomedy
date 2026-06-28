# QA Audit Report: Renomedy

## 1. User Journey Report

### Onboarding & Authentication
*   **Journey:** User launches app -> Login Screen -> Onboarding Flow (3 Steps).
*   **Observations:** The `LoginScreen` uses Clerk for authentication (Email + Password and Google SSO). The `OnboardingScreen` has a 3-step process. In Step 1, the user enters their name and selects a sign-in method (phone or Google), but this seems disconnected from the actual authentication that happens on `LoginScreen`. The `LoginScreen` does not have a "phone number" auth method implemented in the UI, only email and Google SSO.
*   **Issues:** Mismatch between stated auth methods in onboarding (Phone/Google) vs actual login screen (Email/Google).

### Navigation & Core Tabs
*   **Journey:** After onboarding -> Home Screen. User navigates via Drawer and Tabs.
*   **Observations:** The navigation seems robust using React Navigation (Drawer/Tabs). The `HomeScreen` displays family overview and active medication schedules.
*   **Issues:** No critical navigation bugs found in static analysis.

### Prescription Upload & Scanning (OCR Extraction)
*   **Journey:** User goes to Prescriptions Hub -> Uploads image -> OCR Extraction -> Medicine Display -> Guided Verification.
*   **Observations:** The pipeline is a two-step process. In edge-first mode (`MlKitMedGemmaProvider`), ML Kit extracts text on-device, then the backend structures it via MedGemma. Fallbacks to Google Vision/Gemini exist.
*   **Issues:** The `PrescriptionHubScreen` has complex state management (`ProcessingStage`) and handles fallbacks. If the backend fails to return a `cleanedOcrText`, it falls back to raw text. A potential issue is the lack of explicit "network failure" handling specific to the OCR stage beyond a generic `uploadState === 'error'`.

## 2. Critical Bugs List

### Bug 1: Authentication Method Mismatch in Onboarding
*   **Severity:** High
*   **Steps to Reproduce:**
    1. Complete registration on `LoginScreen` (uses Email or Google).
    2. Proceed to `OnboardingScreen`.
    3. Observe Step 1 "Sign-in method" options.
*   **Expected Behavior:** Options should match the authentication methods supported by the app (Email/Google).
*   **Actual Behavior:** Options displayed are "Phone number" and "Google".
*   **Root Cause Analysis:** Hardcoded options `['phone', 'google']` in `OnboardingScreen.tsx` do not reflect the actual Clerk configuration in `LoginScreen.tsx` (Email/Google).
*   **Recommended Fix:** Update the `AuthMethod` type and the UI buttons in `OnboardingScreen.tsx` to reflect 'email' and 'google'.

### Bug 2: Missing Clerk Publishable Key Handling during Network/Initialization failure
*   **Severity:** Medium
*   **Steps to Reproduce:**
    1. Start app without `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in `.env`.
*   **Expected Behavior:** Graceful error message on screen.
*   **Actual Behavior:** App throws a JS error (`Frontend/src/lib/clerk.ts` throws error string) and likely crashes or white-screens.
*   **Root Cause Analysis:** `throw new Error(...)` is executed at module level in `clerk.ts` if the env var is missing.
*   **Recommended Fix:** Handle the missing key gracefully, perhaps by showing an initialization error screen instead of throwing a top-level error.

## 3. Top 10 Fixes
1.  **Onboarding Auth Mismatch:** Fix the "Phone number" option in `OnboardingScreen.tsx` to "Email" to match the `LoginScreen`.
2.  **Clerk Env Var Handling:** Implement a graceful fallback/UI error when `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is missing instead of a hard crash.
3.  **OCR Network Failure State:** Improve specific error messaging in `PrescriptionHubScreen` when the backend OCR endpoint times out or fails due to network issues (currently relies on generic error state).
4.  **Guided Verification Preference:** The `isGuidedVerificationEnabled` state in `PrescriptionHubScreen` relies on `AsyncStorage` but defaults to a confusing state if the key is missing. Ensure default behavior is strictly defined.
5.  **MedGemma JSON Parsing:** While robust, `medgemma.validation.ts` throws an error if JSON is malformed. Ensure the API gracefully returns this error to the frontend as an "OCR Failed, Try Manual" state rather than a 500 error.
6.  **Login Screen Name Field:** On `LoginScreen`, the "Full Name" field is only shown on sign-up, but if Google SSO is used for sign-up, it relies on Google's provided name. Ensure the user's explicitly typed name takes precedence if provided.
7.  **HomeScreen Greeting Fallbacks:** The fallback chain `currentUser?.full_name?.split(' ')[0] ?? user?.firstName ?? user?.fullName?.split(' ')[0] ?? 'Caregiver'` in `HomeScreen` could result in weird greetings if names are formatted differently. Add a trim/capitalize step.
8.  **Empty States:** Add more descriptive empty states in `HomeScreen` when `activeSchedules` or `refillAlerts` are empty, providing calls to action (e.g., "Add a medicine").
9.  **Loading States:** Add skeleton loaders or better loading indicators during the `ProcessingStage = 'saving'` in `PrescriptionHubScreen`.
10. **Localization Consistency:** Ensure Kannada (`kn`) and Hindi (`hi`) translations have all keys present in English (`en.json`), specifically new keys related to MedGemma/OCR errors.

## 4. Beta Readiness Assessment
*   **Status:** **Conditionally Ready**
*   **Summary:** The core architecture (Backend OCR/MedGemma pipeline, Supabase DB, Clerk Auth) is solid and well-typed. The transition to Edge-First OCR (ML Kit + MedGemma) is implemented gracefully with fallbacks.
*   **Blockers for Beta:** The critical discrepancy between the `LoginScreen` (Email) and `OnboardingScreen` (Phone) must be resolved to prevent user confusion. Once this is fixed, the app is ready for Beta testing.

## Cross-Team Dependencies
*   **Frontend & UX:** Needs coordination to update the `OnboardingScreen` auth options to match actual implementation. Needs UX review on error states during OCR network failures.
*   **Backend & Data Systems:** Ensure the MedGemma validation error (`medgemma.validation.ts`) returns a structured 4xx error (e.g., `parse_status: failed`) rather than an unhandled 500 so the frontend can trigger the manual entry fallback.
*   **OCR / ML Kit / MedGemma Architecture:** Coordinate on telemetry for Edge-First OCR vs Server-Side fallback rates to monitor ML Kit performance in the wild.
