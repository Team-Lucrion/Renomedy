# Offline Storage Audit

## PHI

- Prescription photos, OCR text, parsed medicine details, manual medicine drafts, prescription IDs, and prescription history.
- Action: prescription app-data cache is disabled; manual medicine drafts now use `expo-secure-store`.

## PII

- User profile identity, family member names, caregiver relationships, phone/email-backed account context.
- Action: broad app-data cache is disabled and any legacy plaintext cache key is removed on access.

## Sensitive Operational Data

- Medication schedule IDs, pending dose log queue, refill state, notification token.
- Action: pending dose log queue now uses `expo-secure-store`; legacy plaintext queue key is removed on access. Notification token already used `expo-secure-store`.

## Non-Sensitive UI/Cache Data Left In AsyncStorage

- Language preference.
- Onboarding flow flags.
- Doctor-respect note dismissal timestamp.
- Guided verification UI preference and first-completed flag.

These values do not contain prescription text, family medical data, schedules, refill state, or user identity.
