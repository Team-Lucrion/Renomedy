# Clerk, Supabase JWT, and RLS Deployment Checklist

Founder/operator checklist before supervised family beta.

## Clerk JWT Template

- Confirm the production Clerk app has a Supabase-compatible JWT template enabled.
- Confirm the token includes `sub` and that `sub` is the Clerk user ID used in `public.users.clerk_user_id`.
- Confirm mobile clients request the same template expected by Supabase, if a named template is required.
- Confirm expired Clerk sessions cannot call backend APIs.

## Supabase JWT Settings

- Confirm the Supabase project JWT secret/audience settings match the Clerk JWT template.
- Confirm `auth.jwt() ->> 'sub'` returns the Clerk user ID for API calls made through the anon-key Supabase client.
- Confirm service-role keys are present only in backend/server environments.
- Confirm no Supabase service-role key is exposed in Expo, web bundles, mobile config, logs, or analytics.

## Database Identity Functions

Run against production or staging with real test users:

```sql
select public.current_clerk_user_id();
select public.current_user_id();
```

Expected result:
- `current_clerk_user_id()` returns the signed-in Clerk user ID.
- `current_user_id()` returns only that user's row in `public.users`.
- Anonymous requests return no usable user ID.

## RLS Flow Verification

Use two real test accounts: User A and User B.

- User A cannot select, insert, update, or delete User B `family_members`.
- User A cannot select User B `prescriptions` or `prescription_uploads`.
- User A cannot select or update User B `prescription_medications`.
- User A cannot activate User B medication into `medication_schedules`.
- User A cannot read or write User B `dose_logs`.
- User A cannot read or consume User B's email/phone-bound beta invite.
- User A cannot access User B prescription storage object or signed URL unless both users are active members of the same family group.

## Storage Verification

- Confirm `prescriptions` bucket is private.
- Confirm storage object policies restrict access by authenticated identity or backend-issued signed URL only.
- Confirm signed prescription URLs expire and are not logged.

## Evidence To Save

- Clerk JWT template screenshot or export.
- Supabase auth/JWT setting screenshot.
- SQL/RLS test output for User A and User B.
- API test output showing expected 403/404 responses.
