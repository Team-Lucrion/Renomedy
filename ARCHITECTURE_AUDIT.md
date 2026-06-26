# Renomedy Architecture Audit Report

**Date:** March 2025
**Role:** Senior Software Architect Audit
**Project:** Renomedy (Prescription Clarity & Family Medication Governance)

---

## 1. Project Overview

Renomedy is a comprehensive healthcare platform designed to simplify prescription management and ensure medication adherence for families. The system employs a hybrid cloud-and-edge approach to process medical documents and coordinate care.

### Overall Architecture
The project follows a **Client-Server architecture** with a clear separation between the presentation layer and the business logic layer.
- **Frontend:** A React Native (Expo) mobile application serving caregivers and patients.
- **Backend:** A Node.js/Express API acting as the central orchestration hub for AI services, database management, and external integrations.
- **Database & Storage:** Supabase (PostgreSQL) provides the relational data store, real-time capabilities, and secure file storage.
- **Authentication:** Clerk handles identity management, integrated with Supabase via JWT and webhooks.

### Folder Structure
- `Frontend/`: React Native codebase using Expo.
  - `src/screens/`: Navigation targets.
  - `src/context/`: Global state (AppData, Language).
  - `src/utils/`: Business logic for medicine safety and trust.
- `Backend/`: Express server codebase.
  - `src/modules/`: Domain-driven modules (prescriptions, medications, family).
  - `src/services/`: Cross-cutting concerns (OCR, scheduler, notifications).
  - `supabase/`: Database migrations and configuration.
- `Assets/`: Canonical datasets and CSVs for medicine intelligence.

### Technologies Used
- **Frontend:** React Native, Expo, i18next (Localization), Clerk Expo SDK.
- **Backend:** Node.js, Express, TypeScript, Zod (Validation), Pino (Logging), Node-Cron.
- **AI/ML:** Google Cloud Vision (OCR), Google Gemini (Structured Parsing), Tesseract.js.
- **Infrastructure:** Supabase, Clerk, Razorpay (Payments), Firebase Cloud Messaging (FCM).

---

## 2. Existing Functionality

### Authentication & User Management
- **Implementation:** Clerk handles multi-factor authentication. The backend synchronizes Clerk users with the local `users` table via a webhook and a `sync-clerk-user` endpoint.
- **Quality:** High. Follows modern security practices and provides a seamless onboarding flow.

### Prescription Management
- **Implementation:** Supports OCR-assisted uploads and manual entry. The pipeline extracts medicine names, dosages, frequencies, and durations.
- **Quality:** Robust. Handles handwritten notes via a fallback strategy and provides a "manual draft" recovery system.

### Medicine Catalog & Intelligence
- **Implementation:** A sharded CSV-based search engine (`indianMedicines.js`) providing exact and fuzzy matches. Features a "Trust Profile" and "Safety Engine" to detect high-risk drugs (e.g., Insulin).
- **Quality:** Exceptional logic for "molecule-level" relationship detection.

### Reminder & Adherence System
- **Implementation:** Node-cron based scanning for due doses and missed logs. Adherence is tracked via `dose_logs`.
- **Quality:** Functional, but relies on server-side polling rather than push-based event triggers.

---

## 3. Backend Analysis

### API Structure
- **Design Pattern:** Module-based Controller-Service-Route pattern.
- **Validation:** Strict request body validation using Zod schemas.
- **Error Handling:** Centralized `errorHandler` middleware with Sentry integration. Supports custom `HttpError` classes.
- **Logging:** Structured logging using `pino` and `pino-http`.

### Service Layer
- **OCR Factory:** `ocr-provider.factory.ts` allows switching between Vision-Gemini, Tesseract, and Groq providers.
- **Scheduler:** Centralized scheduler for background jobs (reminder scans, refill risks).
- **Audit Service:** Records critical user actions (medication activation, reconciliation).

---

## 4. Database Analysis

The Supabase schema is highly relational and security-conscious.

### Core Tables
- `users`: Core profile and beta access status.
- `family_groups` & `family_members`: Hierarchical structure for caregivers and dependents.
- `prescriptions`: Document metadata, raw OCR text, and AI parse status.
- `prescription_medications`: Structured data extracted from prescriptions.
- `medication_schedules`: Reminders, timing, and food relationship data.
- `dose_logs`: Adherence records (taken, missed, skipped).
- `refill_states`: Inventory tracking and projected runout dates.
- `alerts`: Enqueued notifications for the delivery service.

### Security
- **RLS:** Row Level Security is enabled on every table, ensuring users can only access data within their own family group.
- **Functions:** Custom PL/pgSQL functions for `current_user_id` mapping.

---

## 5. OCR & AI Analysis

The project implements a state-of-the-art **Two-Step Pipeline**:
1. **Extraction (OCR):** Uses Google Cloud Vision (`DOCUMENT_TEXT_DETECTION`) to extract raw text from images.
2. **Structuring (Reasoning):** Uses Google Gemini (2.0 Flash) to parse unstructured text into a validated JSON schema.

**Key Features:**
- **OCR Quality Assessment:** Calculates a confidence score based on alphanumeric density and medical keyword frequency.
- **Hallucination Prevention:** Strict prompts instructing the LLM to only include reasonably visible medicines.
- **Fallbacks:** Includes a Tesseract + Groq (Llama 3) alternative provider.

---

## 6. Medicine Catalog Analysis

### Search Engine
- **Implementation:** Sharded CSV indexing (`Assets/swasthi_beta_intelligence_v2.csv`).
- **Features:**
  - **Exact Match:** Prioritizes brand names.
  - **Alias Match:** Maps common OCR mistakes and brand variants.
  - **Fuzzy Search:** Levenshtein distance used for OCR correction candidates.
- **Validation Engine:** `medicineSafety.ts` blocks high-risk medications from automated scheduling during the beta phase.

---

## 7. Reminder & Scheduling Analysis

### Workflow
1. `scanDueDoseReminders`: Every 5 minutes, the scheduler checks for active schedules matching the current time.
2. `enqueueAlert`: If a dose is due, an entry is created in the `alerts` table.
3. `dispatchScheduledAlerts`: A separate worker picks up pending alerts and sends them via FCM.

### Refill Tracking
- `scanRefillRisk`: Calculates `projected_runout_date` based on `daily_depletion`. Alerts are enqueued when inventory hits the threshold (default 3 days).

---

## 8. Compare Against Target Architecture

| Layer | Status | Reason |
| :--- | :--- | :--- |
| Capture Prescription | **Fully Implemented** | Robust Expo image picker & manipulator. |
| ML Kit Document Scanner | **Missing** | Current implementation uses standard camera/gallery. |
| Image Quality Check | **Missing** | Lacks pre-upload blur or exposure detection. |
| ML Kit Text Recognition v2 | **Missing** | Currently uses Google Cloud Vision (Backend). |
| OCR Cleanup Engine | **Partially Implemented** | Basic whitespace and symbol cleaning exists. |
| Prescription Segmentation | **Missing** | Pipeline treats prescription as a single block. |
| MedGemma 1.5 4B | **Missing** | Currently uses Gemini 2.0 Flash. |
| Medication Catalog | **Fully Implemented** | Robust sharded local/remote catalog exists. |
| Medication Validation Engine | **Fully Implemented** | Molecule-level overlap and high-risk detection. |
| Confidence Scoring Engine | **Fully Implemented** | Per-medicine and per-prescription scoring. |
| Human Verification | **Partially Implemented** | UI for verification exists, but lacks "pharmacist/doctor" workflows. |
| Medication Storage | **Fully Implemented** | Normalized Supabase schema. |
| Schedule Generation | **Fully Implemented** | Logic for BD/TDS/OD frequency mapping. |
| Medicine Intelligence | **Fully Implemented** | Trust profiles and risk tiers. |
| Family Sharing | **Fully Implemented** | "Sanctuary" invitations and membership logic. |
| Analytics | **Fully Implemented** | PostHog and custom audit logging. |
| FHIR/Open Health | **Missing** | Data structure is relational but not yet HL7/FHIR compliant. |

---

## 9. Gap Analysis

### Reuse
- **Database Schema:** Extremely stable; should be the foundation for modernization.
- **Safety Engine:** The logic in `medicineSafety.ts` and `medicineTrust.ts` is highly mature.
- **Family Logic:** Membership and RLS policies are well-implemented.

### Refactor
- **OCR Pipeline:** Move from Backend-heavy (Vision) to Client-side (ML Kit) for better performance and cost.
- **Verification UI:** Transition from "edit form" to "side-by-side comparison" with the image.

### Scratch
- **FHIR Export Layer:** Required for ABDM/Open Health integration.
- **MedGemma 1.5 Integration:** Transitioning structured parsing to healthcare-specialized LLMs.

---

## 10. Risk Assessment

- **High-Risk:** OCR accuracy on handwritten prescriptions remains the primary safety concern.
- **Technical Debt:** Reliance on `node-cron` in a single-instance Express app may not scale; consider PG-Boss or Supabase Edge Functions for job scheduling.
- **Modernization Strategy:** **"Edge-First Migration"**. Shift OCR to the device using ML Kit to provide instant feedback to users, while retaining the Backend for high-reasoning tasks with MedGemma.

---

## 11. Project Completion Estimate

- **Overall: 75%**
- **Backend: 85%** (API, DB, and Security are near-production ready).
- **Frontend: 75%** (UI is functional but needs refinement for "guided" workflows).
- **AI Pipeline: 60%** (Current Vision-Gemini is a strong baseline, but ML Kit/MedGemma migration is significant).

---

## 12. Modernization Roadmap

### Sprint 1: Edge OCR & UX Hardening
- Implement ML Kit Document Scanner on Frontend.
- Add real-time image quality feedback (blur/lighting).
- Reuse existing Backend structuring (Gemini) as the logic remains valid.

### Sprint 2: MedGemma & Verification
- Integrate MedGemma 1.5 4B for structured medicine extraction.
- Implement side-by-side image-vs-text verification UI.
- Add "Confidence Heatmaps" on the image.

### Sprint 3: Health Ecosystem Readiness
- Map internal JSON to FHIR MedicationRequest resources.
- Implement data export for Open Health Stack.
- Harden Family Sharing for "Co-Caregiver" permissions.

---
**End of Audit Report**
