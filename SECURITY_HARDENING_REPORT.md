# Security Hardening Report

This document details the backend hardening measures implemented to resolve critical security and reliability findings from the recent audit.

## 1. Resolved Issues

### SSRF Protection Improvements
- **Issue:** The image URL fetching mechanism in `prescriptions.service.ts` resolved DNS to block private IP addresses, but was vulnerable to DNS rebinding because the actual fetch occurred using the hostname.
- **Fix:** Refactored `assertPublicImageUrl` to return the verified, safe IP address. Updated `resolveImageUrl` to construct the `https.get` request using this IP address directly via a custom `lookup` function while passing the original hostname in the `Host` header. The fetch call also uses strict redirect handling to prevent following redirects to internal network addresses.

### Distributed Rate Limiting Architecture
- **Issue:** The API rate limiter in `rate-limit.ts` relied solely on an in-memory store, allowing limits to be easily bypassed in multi-instance environments.
- **Fix:** Integrated `ioredis` and `rate-limit-redis`. The rate limiter now checks for a `REDIS_URL` environment variable. If present, it initializes a distributed Redis store, ensuring rate limits are globally enforced across all backend instances while gracefully falling back to memory if Redis is unavailable. Fast-fail connection settings were also applied.

### OCR Metadata Passthrough Fixes
- **Issue:** The Zod validation schema `processPrescriptionV2BodySchema` used `z.record(z.unknown())`, which strictly strips unlisted keys within nested objects, resulting in silent data loss of rich OCR metadata from edge ML Kit pipelines.
- **Fix:** Changed the type of `ocrMetadata` and `segmentation` fields to `z.any()`, ensuring all passed telemetry and mapping data from mobile clients is retained without truncation.

### Confidence Validation Improvements
- **Issue:** The `medGemmaMedicineSchema` used `.catch("low")` on the `confidence` field, silently masking malformed values returned by the model and making it impossible to observe AI degradation.
- **Fix:** Updated the `.catch` block to utilize a callback that explicitly logs the invalid confidence value via Pino before safely defaulting to `"low"`.

### MedGemma Timeout Handling Improvements
- **Issue:** The `MedGemmaService` used an `AbortController` for timeouts but did not specifically handle the resulting `AbortError`, throwing generic errors. Additionally, the exponential backoff lacked a maximum cap, potentially causing infinite thread locks or excessive delays.
- **Fix:** Added specific handling for `AbortError` to map it to a distinct "Network timeout" error. Implemented a maximum cap of 10,000ms (10 seconds) on the exponential backoff delay to ensure the request thread can reliably shed load.

### Data Integrity Improvements
- **Issue:** The regex replacements in `normalizeMedicineNameCandidate` aggressively combined distinct operations, accidentally removing spaces and mangling legitimate medicine names (e.g. converting "telma 40mg bd" into "telmabd").
- **Fix:** Reordered the regex operations and split the replacement chains. Added spaces around replaced dosage and frequency abbreviations, ensuring name components stay separate before trailing whitespace trimming is applied.

### DoS Timeout Regression Fix
- **Issue:** Replacing the native `fetch` with `https.get` removed the absolute request timeout, making the server vulnerable to slowloris-style DoS attacks.
- **Fix:** Wrapped the `https.get` call in an absolute `setTimeout` of 10 seconds that forcefully destroys the socket and rejects the request if the fetch takes too long.

## 2. Risk Mitigation Summary
| Risk | Mitigation | Status |
| :--- | :--- | :--- |
| **Server-Side Request Forgery (SSRF)** | Enforce fetching by safe IP and disabling redirects via `https.get`. | Mitigated |
| **Rate Limit Bypass (DDoS)** | Distributed Redis rate limiting for global enforcement. | Mitigated |
| **Data Loss (Silent)** | Weak Zod schemas replaced with `z.any()` where appropriate for telemetry. | Mitigated |
| **Silent Model Degradation** | Replaced silent catches with explicit logging for malformed structured data. | Mitigated |
| **Thread Locking / Availability** | Explicit abort catching and capped exponential backoff limits. | Mitigated |
| **Slowloris DoS Attacks** | Enforced absolute timeout of 10 seconds during image fetching. | Mitigated |

## 3. Security Validation Checklist
- [x] Tested URL fetching mechanism rejects `localhost` and `127.0.0.1`.
- [x] Verified `rate-limit-redis` correctly initializes if `REDIS_URL` is set, without throwing fatal errors.
- [x] Confirmed backend unit tests pass without regressions (`npm run test`).
- [x] Backwards compatibility maintained for API endpoints.
- [x] Code comments updated to explain security-sensitive logic explicitly.
