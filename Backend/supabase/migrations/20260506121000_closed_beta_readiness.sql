create table if not exists public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  email text,
  phone text,
  clerk_user_id text,
  status text not null default 'approved' check (status in ('approved', 'consumed', 'revoked')),
  approved_by_user_id uuid references public.users(id) on delete set null,
  used_by_user_id uuid references public.users(id) on delete set null,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or phone is not null or clerk_user_id is not null)
);

create trigger trg_beta_invites_set_updated_at
before update on public.beta_invites
for each row
execute function public.set_updated_at();

alter table public.users
  add column if not exists beta_access_status text not null default 'pending' check (beta_access_status in ('pending', 'active', 'revoked')),
  add column if not exists beta_invite_id uuid references public.beta_invites(id) on delete set null,
  add column if not exists beta_access_granted_at timestamptz,
  add column if not exists beta_access_revoked_at timestamptz;

alter table public.prescriptions
  add column if not exists ocr_confidence_score numeric;

alter table public.prescription_medications
  add column if not exists brand_name text,
  add column if not exists food_timing text,
  add column if not exists verification_notes text,
  add column if not exists verified_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists verified_at timestamptz,
  add column if not exists is_user_corrected boolean not null default false,
  add column if not exists last_corrected_at timestamptz;

alter table public.refill_states
  add column if not exists daily_depletion numeric,
  add column if not exists last_dose_logged_at timestamptz;

alter table public.alerts
  drop constraint if exists alerts_status_check;

alter table public.alerts
  add constraint alerts_status_check check (status in ('pending', 'sent', 'failed', 'dismissed'));

create index if not exists idx_beta_invites_invite_code on public.beta_invites(invite_code);
create index if not exists idx_beta_invites_status on public.beta_invites(status);
create index if not exists idx_users_beta_access_status on public.users(beta_access_status);

alter table public.beta_invites enable row level security;

create policy beta_invites_self_select
on public.beta_invites
for select
using (
  used_by_user_id = public.current_user_id()
  or clerk_user_id = public.current_clerk_user_id()
  or exists (
    select 1
    from public.users u
    where u.id = public.current_user_id()
      and u.beta_invite_id = beta_invites.id
  )
);
