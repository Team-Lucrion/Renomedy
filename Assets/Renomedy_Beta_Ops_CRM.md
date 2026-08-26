# Renomedy Beta Ops CRM

## Objective

Manual operating system for acquiring, approving, onboarding, and retaining early beta users.

Keep separation clear:

- Beta invite = app entry approval
- Sanctuary invite = family entry after user already has app access

---

## 1. Tally Intake Fields

Recommended fields:

- Full name
- WhatsApp number
- Email
- City
- Relationship to patient
- Are you managing medicines for:
  - self
  - parent
  - spouse
  - child
  - multiple family members
- How many active medicines in the household
- Have you ever struggled to read a prescription
- Are reminders/refills a real problem
- Would you be open to sending feedback during beta
- Source:
  - Instagram
  - WhatsApp
  - doctor
  - pharmacist
  - referral
  - QR
  - other

---

## 2. Google Sheet Structure

Suggested columns:

- `lead_id`
- `created_at`
- `name`
- `phone`
- `email`
- `city`
- `caregiver_type`
- `household_type`
- `medicine_complexity`
- `source`
- `priority_score`
- `status`
- `beta_code`
- `beta_code_sent_at`
- `signed_in`
- `beta_redeemed`
- `sanctuary_created`
- `sanctuary_joined`
- `first_prescription_uploaded`
- `first_reno_it_share`
- `payment_intent`
- `feedback_status`
- `last_contacted_at`
- `next_follow_up_at`
- `notes`

---

## 3. User Lifecycle

Use these exact states:

1. Applied
2. Reviewed
3. Approved
4. Code Generated
5. Code Sent
6. Joined
7. First Prescription Upload
8. First Reno It Share
9. Active
10. Lost

Lifecycle rule:

- only move forward when the user actually completed the previous behavior

---

## 4. Beta Invite Code Naming System

Recommended format:

- `RENO-BETA-WA-01`
- `RENO-BETA-REF-01`
- `RENO-BETA-DOC-01`
- `RENO-BETA-PHARM-01`
- `RENO-BETA-CARE-01`

Meaning:

- `WA` = WhatsApp sourced
- `REF` = referral
- `DOC` = doctor pilot
- `PHARM` = pharmacist pilot
- `CARE` = direct caregiver validation

This helps source attribution even before full analytics maturity.

---

## 5. WhatsApp Onboarding Scripts

### Initial approval script

```text
Hi [Name], you’re approved for the Renomedy beta.

Renomedy helps families understand prescriptions clearly, organize medicines inside a private Sanctuary, and stay on top of reminders and refills.

Your beta invite code:
[BETA_CODE]

Next steps:
1. Open the app
2. Sign in
3. Enter this beta code
4. Create or join your Sanctuary
5. Upload your first prescription

If you get stuck at any point, reply here and we’ll help directly.
```

### After first upload

```text
Did your first prescription upload work clearly?

Please tell us:
1. Was the medicine list understandable?
2. Did anything feel confusing or risky?
3. Would you trust this enough to use with your family?
```

---

## 6. Follow-up Scripts

### No action after code sent

```text
Hi [Name], just checking in.

Were you able to open Renomedy and enter your beta code?
If not, send a screenshot and we’ll help immediately.
```

### Joined but no upload

```text
Hi [Name], the best way to feel Renomedy is to upload one real prescription.

Once you do that, we can help you check whether the output feels trustworthy and useful for your family.
```

### Uploaded but inactive

```text
Hi [Name], did Renomedy help make the prescription clearer?

If something felt off, tell us directly. That feedback is exactly what shapes the beta.
```

---

## 7. Trust Messaging

Always use:

- Renomedy helps you understand and track
- always follow your doctor’s instructions
- review unclear medicines carefully before relying on them

Never say:

- fully automated medical truth
- guaranteed correct prescription reading
- doctor replacement

---

## 8. Priority Scoring System

Suggested 10-point score:

- `+3` managing medicines for parent / elder
- `+2` multiple active medicines in household
- `+2` has repeated prescription confusion
- `+1` willing to give feedback
- `+1` likely to refer family
- `+1` doctor/pharmacist sourced

Priority bands:

- `8-10` = highest-priority beta user
- `5-7` = strong fit
- `3-4` = medium fit
- `0-2` = low-priority or waitlist

---

## 9. Feedback Collection Framework

Collect feedback at 3 moments:

### Moment 1: after beta redeem

- was entry smooth
- was beta gate confusing

### Moment 2: after first prescription upload

- was output understandable
- was anything missing
- did trust increase or decrease

### Moment 3: after first week

- did they return
- did they add family
- did they use reminders
- would they refer someone

---

## 10. Founder Daily Beta Ops Checklist

Every day:

1. Review new Tally entries
2. Score and approve top candidates
3. Generate and send beta codes
4. Follow up with users who received codes but did not join
5. Follow up with users who joined but did not upload
6. Review first-upload feedback
7. Mark active vs lost users
8. Record source attribution
9. Identify 1-3 users for direct founder conversation

---

## 11. Operating Principle

The first beta CRM is not about volume.

It is about:

- right families
- trust-rich feedback
- observable activation
- referral readiness

Optimize for learning quality before scale.
---

## 12. First-50 Acquisition Queue

The existing fields and beta lifecycle above remain the source of truth after a family enters the beta process. Add this pre-funnel to the same record or linked acquisition_leads record so prospect research does not become a second disconnected spreadsheet.

### Pre-funnel states

Use these states before Applied:

1. Researched — public source found; no contact made.
2. Qualified — score is 5 or higher and the person appears to be a caregiver with a real medication-management problem.
3. Awaiting Approval — an outreach draft is ready; founder decision is required.
4. Approved to Contact — founder explicitly approved the draft and channel.
5. Contacted — message was sent manually or through an explicitly approved integration.
6. Replied — the person responded.
7. Qualified Conversation — caregiver need, willingness to try, and beta fit were confirmed.
8. Do Not Contact or Not a Fit — stop follow-up and record why.

### Required acquisition fields

- source: PUBLIC_THREAD, COMMUNITY_HOST, COLD_LOCAL, CONTENT_REPLY, INBOUND, REFERRAL, DOC, or PHARM.
- source_url: public post, public organisation page, or public business page used for research.
- public_handle: public username or public business/community handle; do not collect private contact details during research.
- research_summary: only observable, non-sensitive context relevant to the caregiving problem.
- consent_status: research_only, opted_in, or do_not_contact.
- priority_score: existing 10-point fit score, with a minimum of 5 for the founder approval queue.
- outreach_draft: permission-first message prepared by AI; never auto-sent.
- approval_status: pending, approved, or rejected.
- next_follow_up_at, last_response_at, contacted_at, and a short founder note.

### Source rules for zero-distribution acquisition

- PUBLIC_THREAD means a public post where the caregiver has already described a relevant problem; reply only where platform rules allow it.
- COMMUNITY_HOST means a moderator, NGO, or community operator who has publicly invited contact; request permission before sharing anything with members.
- COLD_LOCAL means a public clinic, pharmacy, elder-care service, or caregiver organisation page; the founder makes the first relationship-building contact.
- CONTENT_REPLY is a useful answer or clarity artifact attached to a real conversation, not a broadcast campaign.
- INBOUND and REFERRAL remain the preferred low-friction sources once the first families exist.

### Human approval and privacy rules

- AI may discover public sources, summarize the evidence, score fit, and draft a message.
- AI must not send a message, join a private group, infer a medical diagnosis, or store private health information without an explicit human decision and user-provided consent.
- Founder approval is required before every external outreach action.
- A beta code is sent only after the founder confirms the conversation is qualified.

### Database mapping

The acquisition queue maps into the existing beta lifecycle at Applied → Reviewed → Approved → Code Generated → Code Sent → Joined → First Prescription Upload → Active. The daily brief should show both queues together so the founder works from one prioritized list.
