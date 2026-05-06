create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_clerk_user_id()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'sub', '');
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  full_name text,
  email text,
  phone text,
  role text not null check (role in ('self', 'caregiver')),
  preferred_language text not null default 'en',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select u.id
  from public.users u
  where u.clerk_user_id = public.current_clerk_user_id()
  limit 1;
$$;

create table if not exists public.family_groups (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  family_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  added_by_user_id uuid not null references public.users(id) on delete restrict,
  full_name text not null,
  relationship text,
  dob date,
  gender text,
  chronic_conditions text[] not null default '{}',
  allergies text[] not null default '{}',
  notes text,
  is_primary_dependent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  family_member_id uuid not null references public.family_members(id) on delete cascade,
  uploaded_by_user_id uuid not null references public.users(id) on delete restrict,
  doctor_name text,
  hospital_name text,
  prescription_date date,
  image_url text,
  raw_ocr_text text,
  parse_status text not null default 'pending' check (parse_status in ('pending', 'parsed', 'verified', 'failed')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'user_verified', 'pharmacist_verified', 'doctor_verified')),
  created_at timestamptz not null default now()
);

create table if not exists public.prescription_medications (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  medicine_name text not null,
  generic_name text,
  dosage text,
  frequency text,
  timing text,
  duration text,
  shorthand_detected text[] not null default '{}',
  shorthand_explanation text,
  instructions text,
  confidence_score numeric,
  requires_manual_verification boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  family_member_id uuid not null references public.family_members(id) on delete cascade,
  prescription_medication_id uuid not null references public.prescription_medications(id) on delete cascade,
  start_date date,
  end_date date,
  reminder_times time[] not null default '{}',
  food_relation text,
  refill_threshold_days int not null default 3,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.dose_logs (
  id uuid primary key default gen_random_uuid(),
  medication_schedule_id uuid not null references public.medication_schedules(id) on delete cascade,
  scheduled_time timestamptz,
  taken_time timestamptz,
  status text not null check (status in ('taken', 'missed', 'skipped', 'snoozed')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  fcm_token text not null,
  platform text,
  created_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  family_member_id uuid references public.family_members(id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  scheduled_for timestamptz,
  sent_at timestamptz,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.refill_states (
  id uuid primary key default gen_random_uuid(),
  medication_schedule_id uuid not null references public.medication_schedules(id) on delete cascade,
  quantity_total int,
  quantity_remaining int,
  projected_runout_date date,
  continuity_status text check (continuity_status in ('safe', 'risk_soon', 'will_run_out', 'out_of_stock')),
  updated_at timestamptz not null default now()
);

create trigger trg_refill_states_set_updated_at
before update on public.refill_states
for each row
execute function public.set_updated_at();

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  family_member_id uuid not null references public.family_members(id) on delete cascade,
  consent_type text not null,
  granted boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_clerk_user_id on public.users(clerk_user_id);
create index if not exists idx_family_groups_owner_user_id on public.family_groups(owner_user_id);
create index if not exists idx_family_members_family_group_id on public.family_members(family_group_id);
create index if not exists idx_prescriptions_family_member_id on public.prescriptions(family_member_id);
create index if not exists idx_prescriptions_uploaded_by_user_id on public.prescriptions(uploaded_by_user_id);
create index if not exists idx_prescription_medications_prescription_id on public.prescription_medications(prescription_id);
create index if not exists idx_medication_schedules_family_member_id on public.medication_schedules(family_member_id);
create index if not exists idx_medication_schedules_prescription_medication_id on public.medication_schedules(prescription_medication_id);
create index if not exists idx_dose_logs_medication_schedule_id on public.dose_logs(medication_schedule_id);
create index if not exists idx_notification_tokens_user_id on public.notification_tokens(user_id);
create index if not exists idx_alerts_user_id on public.alerts(user_id);
create index if not exists idx_alerts_family_member_id on public.alerts(family_member_id);
create index if not exists idx_refill_states_medication_schedule_id on public.refill_states(medication_schedule_id);
create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);
create index if not exists idx_consent_records_user_id on public.consent_records(user_id);
create index if not exists idx_consent_records_family_member_id on public.consent_records(family_member_id);

alter table public.users enable row level security;
alter table public.family_groups enable row level security;
alter table public.family_members enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_medications enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.dose_logs enable row level security;
alter table public.notification_tokens enable row level security;
alter table public.alerts enable row level security;
alter table public.refill_states enable row level security;
alter table public.audit_logs enable row level security;
alter table public.consent_records enable row level security;

create policy users_select_own
on public.users
for select
using (clerk_user_id = public.current_clerk_user_id());

create policy users_insert_own
on public.users
for insert
with check (clerk_user_id = public.current_clerk_user_id());

create policy users_update_own
on public.users
for update
using (clerk_user_id = public.current_clerk_user_id())
with check (clerk_user_id = public.current_clerk_user_id());

create policy family_groups_owner_all
on public.family_groups
for all
using (owner_user_id = public.current_user_id())
with check (owner_user_id = public.current_user_id());

create policy family_members_owner_all
on public.family_members
for all
using (
  exists (
    select 1
    from public.family_groups fg
    where fg.id = family_members.family_group_id
      and fg.owner_user_id = public.current_user_id()
  )
)
with check (
  exists (
    select 1
    from public.family_groups fg
    where fg.id = family_members.family_group_id
      and fg.owner_user_id = public.current_user_id()
  )
  and added_by_user_id = public.current_user_id()
);

create policy prescriptions_owner_all
on public.prescriptions
for all
using (
  exists (
    select 1
    from public.family_members fm
    join public.family_groups fg on fg.id = fm.family_group_id
    where fm.id = prescriptions.family_member_id
      and fg.owner_user_id = public.current_user_id()
  )
)
with check (
  uploaded_by_user_id = public.current_user_id()
  and exists (
    select 1
    from public.family_members fm
    join public.family_groups fg on fg.id = fm.family_group_id
    where fm.id = prescriptions.family_member_id
      and fg.owner_user_id = public.current_user_id()
  )
);

create policy prescription_medications_owner_all
on public.prescription_medications
for all
using (
  exists (
    select 1
    from public.prescriptions p
    join public.family_members fm on fm.id = p.family_member_id
    join public.family_groups fg on fg.id = fm.family_group_id
    where p.id = prescription_medications.prescription_id
      and fg.owner_user_id = public.current_user_id()
  )
)
with check (
  exists (
    select 1
    from public.prescriptions p
    join public.family_members fm on fm.id = p.family_member_id
    join public.family_groups fg on fg.id = fm.family_group_id
    where p.id = prescription_medications.prescription_id
      and fg.owner_user_id = public.current_user_id()
  )
);

create policy medication_schedules_owner_all
on public.medication_schedules
for all
using (
  exists (
    select 1
    from public.family_members fm
    join public.family_groups fg on fg.id = fm.family_group_id
    where fm.id = medication_schedules.family_member_id
      and fg.owner_user_id = public.current_user_id()
  )
)
with check (
  exists (
    select 1
    from public.family_members fm
    join public.family_groups fg on fg.id = fm.family_group_id
    where fm.id = medication_schedules.family_member_id
      and fg.owner_user_id = public.current_user_id()
  )
);

create policy dose_logs_owner_all
on public.dose_logs
for all
using (
  exists (
    select 1
    from public.medication_schedules ms
    join public.family_members fm on fm.id = ms.family_member_id
    join public.family_groups fg on fg.id = fm.family_group_id
    where ms.id = dose_logs.medication_schedule_id
      and fg.owner_user_id = public.current_user_id()
  )
)
with check (
  exists (
    select 1
    from public.medication_schedules ms
    join public.family_members fm on fm.id = ms.family_member_id
    join public.family_groups fg on fg.id = fm.family_group_id
    where ms.id = dose_logs.medication_schedule_id
      and fg.owner_user_id = public.current_user_id()
  )
);

create policy notification_tokens_owner_all
on public.notification_tokens
for all
using (user_id = public.current_user_id())
with check (user_id = public.current_user_id());

create policy alerts_owner_all
on public.alerts
for all
using (user_id = public.current_user_id())
with check (user_id = public.current_user_id());

create policy refill_states_owner_all
on public.refill_states
for all
using (
  exists (
    select 1
    from public.medication_schedules ms
    join public.family_members fm on fm.id = ms.family_member_id
    join public.family_groups fg on fg.id = fm.family_group_id
    where ms.id = refill_states.medication_schedule_id
      and fg.owner_user_id = public.current_user_id()
  )
)
with check (
  exists (
    select 1
    from public.medication_schedules ms
    join public.family_members fm on fm.id = ms.family_member_id
    join public.family_groups fg on fg.id = fm.family_group_id
    where ms.id = refill_states.medication_schedule_id
      and fg.owner_user_id = public.current_user_id()
  )
);

create policy audit_logs_owner_all
on public.audit_logs
for all
using (user_id = public.current_user_id())
with check (user_id = public.current_user_id());

create policy consent_records_owner_all
on public.consent_records
for all
using (user_id = public.current_user_id())
with check (
  user_id = public.current_user_id()
  and exists (
    select 1
    from public.family_members fm
    join public.family_groups fg on fg.id = fm.family_group_id
    where fm.id = consent_records.family_member_id
      and fg.owner_user_id = public.current_user_id()
  )
);
