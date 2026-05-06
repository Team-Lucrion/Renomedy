# Swasthi Backend (Supabase + Clerk)
This backend foundation is built for Swasthi’s caregiver-first medication governance MVP.
Authentication is handled by Clerk. Supabase Auth is intentionally not used.
Every application user must map to `users.clerk_user_id`.

## What is included
- Supabase SQL migration for 12 tables:
  - Core caregiver medication flow: `users`, `family_groups`, `family_members`, `prescriptions`, `prescription_medications`, `medication_schedules`, `dose_logs`
  - Phase-2 skeletons: `notification_tokens`, `alerts`, `refill_states`, `audit_logs`, `consent_records`
- Row Level Security enabled on all tables
- Ownership-based RLS policies wired to Clerk JWT `sub` via helper functions
- Seed dataset for doctor demo:
  - Rajath user
  - Patil Family group
  - Mom and Dad members
  - One sample prescription with 3 sample medicines:
    - Metformin 500mg
    - Atorvastatin 20mg
    - Thyroxine 50mcg
- Supabase Edge Function stubs:
  - `sync-clerk-user`
  - `create-family-group`
  - `add-family-member`
  - `upload-prescription`
  - `save-ocr-parse`
  - `activate-medication-schedule`
  - `log-dose`
  - `get-family-dashboard`

## Folder structure
- `supabase/config.toml`
- `supabase/migrations/20260504143000_init_swasthi_backend.sql`
- `supabase/seed.sql`
- `supabase/functions/_shared/response.ts`
- `supabase/functions/<function-name>/index.ts`

## Local setup
1. Install Supabase CLI.
2. From this `Backend` directory, start Supabase:
   - `supabase start`
3. Apply migrations and seed:
   - `supabase db reset`
4. Serve all Edge Functions locally:
   - `supabase functions serve`
5. Test any function:
   - `supabase functions invoke sync-clerk-user --no-verify-jwt --body '{"clerk_user_id":"user_rajath_demo"}'`

## Clerk integration note
- Clerk is the identity provider.
- Your API layer should pass Clerk JWTs to Supabase so RLS can resolve `auth.jwt()->>'sub'`.
- `public.current_user_id()` maps the Clerk `sub` to `users.id`.

## Security model (MVP-safe baseline)
- RLS is enabled on all tables.
- Users can only read/write rows they own through ownership chains:
  - Family groups by `owner_user_id`
  - Family members via group ownership
  - Prescriptions via family-member ownership
  - Medications via prescription ownership
  - Dose logs via schedule ownership
- This keeps policies simple and secure for MVP while remaining extensible.

## Trust and healthcare safety
- Swasthi never diagnoses.
- Swasthi never replaces doctors.
- OCR/prescription interpretation outputs require human verification.
- Edge function stubs include disclaimer metadata in responses where relevant.
