# Backend Audit Report: Findings & Prioritized Fixes

Based on my analysis of the Renomedy backend systems, here is the backend health report covering API endpoints, request/response flows, security, data integrity, OCR pipeline, and overall reliability.

## 1. Backend Health Report
- The backend runs on Node.js/Express with TypeScript and Supabase integration. It features structured request validation (using Zod), centralized error handling, basic rate limiting, structured logging (Pino), and observability via Sentry and PostHog.
- The primary OCR & AI processing flow is implemented across `/prescriptions` endpoints, using a factory pattern to delegate to multiple OCR and AI providers (e.g., VisionGemini, MedGemma).
- A critical v2 modernization flow (`/api/v2/prescriptions/process`) has been started but is currently relying on incoming structured data for OCR processing decoupled from the internal fallback systems.
- Overall health is fair, but lacks key protections against data loss and synchronization issues between backend AI parsing and external state.

## 2. Critical Issues
- **Data Loss Risk / Schema Validation Failure:** In `processPrescriptionV2BodySchema` within `Backend/src/modules/prescriptions/prescriptions.schemas.ts`, passthrough fields like `ocrMetadata` and `segmentation` use `z.record(z.unknown()).optional()`. Since Zod strictly strips unlisted keys by default, nested objects may lose data if not modeled appropriately, specifically during edge-to-backend requests sending rich payload metadata.
- **Timeout and Reliability Risk in MedGemma Inference:** In `Backend/src/services/ai/medgemma/medgemma.service.ts`, the `makeRequest` method applies a naive timeout using `AbortController` over the fetch call. In the retry loop, the exponential backoff uses `Math.pow(2, attempt) * 1000`. If `retryCount` is high and `timeoutMs` is also long, a completely stalling endpoint could lock a request thread for a significant duration without shedding load, creating a severe bottleneck under concurrent traffic. Furthermore, the `AbortError` is not specifically caught to distinguish between true connection failures and timeout-induced aborts, masking the exact reason for the failure in logs.

## 3. Performance Issues
- **Synchronous Medicine Profile Evaluation:** In `Backend/src/utils/medicineTrust.ts`, `evaluateMedicineRelationships` runs synchronously over potentially large lists of existing medicines, computing profiles and comparing states. If a user has a long prescription history, this loop can block the Node.js event loop.
- **Unoptimized Payload Generation for MedGemma:** The current `extractMedicines` logic logs the entire raw OCR response locally (in `rawResponseContent`), which could be several megabytes if the document size is large, leading to significant memory overhead and log pollution.

## 4. Security Findings
- **SSRF (Server-Side Request Forgery) Vulnerability Risk:** In `Backend/src/modules/prescriptions/prescriptions.service.ts`, `assertPublicImageUrl` attempts to block private IP addresses, but does so immediately after resolving `hostname`. If an attacker provides a hostname that resolves to a public IP on the first DNS lookup, but later resolves to a private IP (DNS Rebinding), or if the `fetch` later follows redirects to internal services, it's vulnerable to SSRF.
- **Potential Rate Limit Bypass:** The API rate limiter (`apiRateLimiter` in `Backend/src/middleware/rate-limit.ts`) relies on `express-rate-limit` without configuring a distributed store (like Redis). In a multi-instance deployment, rate limits are tracked in memory per instance, making it easy for an attacker to bypass limits by rotating IPs or hitting different instances.

## 5. Data Integrity Findings
- **Medicine Name Sanitization Flaws:** In `Backend/src/services/ocr/gemini-prescription-parse.ts`, `sanitizeMedicineName` and `normalizeMedicineNameCandidate` use regex replacements that can accidentally mangle valid medicine names containing specific character patterns. It replaces certain standalone terms with spaces but does not prevent trailing or repeated spaces efficiently, leading to inconsistent keys during deduplication.
- **Loss of Confidence Data:** The Zod `medGemmaMedicineSchema` (in `Backend/src/services/ai/medgemma/medgemma.validation.ts`) sets a catch-all `.catch("low")` on `confidence`. This masks actual invalid confidence values returned by the model and treats them silently as "low", obscuring potential model degradation or parsing bugs.

## 6. Recommended Fix Priority Order
1. Fix SSRF vulnerability in image URL fetching by preventing redirects and strictly binding the fetched host to the verified IP address. *(Security)*
2. Configure a persistent store for `express-rate-limit` (e.g., Redis via Supabase if applicable) to enforce global rate limits. *(Security / Performance)*
3. Ensure `processPrescriptionV2BodySchema` properly passes through arbitrary OCR metadata without silent stripping. *(Data Loss / Edge AI Support)*
4. Fix `medgemma.validation.ts` schema to properly log validation errors instead of quietly defaulting confidence to "low". *(Data Integrity)*
5. Improve the timeout and retry mechanism in `MedGemmaService` to handle `AbortError` gracefully and cap maximum retry delay. *(Reliability)*
6. Optimize `evaluateMedicineRelationships` to handle large histories asynchronously or with improved lookup maps. *(Performance)*

## Cross-Team Dependencies
- **OCR / ML Kit / MedGemma Architecture Team:** Needs coordination to ensure the backend OCR metadata schema (`processPrescriptionV2BodySchema`) matches exactly what the mobile client and ML Kit will send, preventing validation drops.
- **Backend & Data Systems / Platform Team:** Needs coordination to set up a shared Redis instance for distributed rate limiting.
- **Frontend & UX Team:** Needs to ensure the frontend properly handles distinct timeout errors if the backend returns a `PROVIDER_TIMEOUT` vs a generic `INTERNAL_ERROR`.
