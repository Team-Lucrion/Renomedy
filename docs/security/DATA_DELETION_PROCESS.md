# Closed Beta Data Deletion Process

This is the beta deletion process until a fully automated in-app account deletion flow is implemented.

## Request Path

Users and caregivers can request deletion by emailing:

`support@renomedy.com`

The request should include the phone number or email used to sign in. Do not send prescription photos or medical documents by email.

## Response Timeline

- Acknowledge the request within 7 calendar days.
- Complete eligible deletion within 30 calendar days after identity verification.
- If deletion is delayed or partially limited, explain what remains and why.

## Data Intended For Deletion

After identity verification, delete or de-identify:

- User profile data.
- Family group membership data.
- Family member profiles created by the user where deletion is appropriate.
- Prescription records, prescription images, OCR text, parsed medicine records, and manual medicine drafts.
- Medication schedules, dose logs, refill states, notification tokens, and notification preferences.
- Beta invite linkage for that user where operationally safe.

## Data That May Be Retained Temporarily

Some records may be retained for security, fraud prevention, payment reconciliation, legal compliance, or abuse investigation:

- Audit logs.
- Payment records required for accounting or dispute handling.
- Security events and webhook delivery records.
- Backups until normal backup expiry.

Retained records should be minimized, access-restricted, and not used for product analytics.

## In-App Copy Guidance

Until an in-app delete button is implemented, profile/help screens should say:

"To request account and beta data deletion, email support@renomedy.com from your sign-in email or include your sign-in phone number. We will acknowledge within 7 days and complete eligible deletion within 30 days after verification."
