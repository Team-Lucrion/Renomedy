create or replace function public.generate_family_invite_code()
returns text
language sql
volatile
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
$$;

alter table public.family_groups
  add column if not exists invite_code text;

update public.family_groups
set invite_code = public.generate_family_invite_code()
where invite_code is null;

alter table public.family_groups
  alter column invite_code set default public.generate_family_invite_code(),
  alter column invite_code set not null;

create unique index if not exists idx_family_groups_invite_code on public.family_groups(invite_code);

create table if not exists public.family_group_memberships (
  id uuid primary key default gen_random_uuid(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'caregiver')),
  status text not null default 'active' check (status in ('active', 'invited')),
  created_at timestamptz not null default now(),
  unique (family_group_id, user_id)
);

insert into public.family_group_memberships (family_group_id, user_id, role, status)
select fg.id, fg.owner_user_id, 'owner', 'active'
from public.family_groups fg
on conflict (family_group_id, user_id) do nothing;

create table if not exists public.prescription_uploads (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  created_at timestamptz not null default now(),
  unique (prescription_id)
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reminders_enabled boolean not null default true,
  refill_alerts_enabled boolean not null default true,
  missed_dose_alerts_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create trigger trg_notification_preferences_set_updated_at
before update on public.notification_preferences
for each row
execute function public.set_updated_at();

create unique index if not exists idx_refill_states_schedule_unique on public.refill_states(medication_schedule_id);
create unique index if not exists idx_notification_tokens_user_token_unique on public.notification_tokens(user_id, fcm_token);
create index if not exists idx_dose_logs_schedule_status_time on public.dose_logs(medication_schedule_id, status, scheduled_time);
create index if not exists idx_alerts_dispatch on public.alerts(status, scheduled_for) where sent_at is null;
create index if not exists idx_family_group_memberships_user_id on public.family_group_memberships(user_id);
create index if not exists idx_family_group_memberships_group_id on public.family_group_memberships(family_group_id);
create index if not exists idx_prescription_uploads_prescription_id on public.prescription_uploads(prescription_id);

alter table public.family_group_memberships enable row level security;
alter table public.prescription_uploads enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists family_groups_owner_all on public.family_groups;
drop policy if exists family_members_owner_all on public.family_members;
drop policy if exists prescriptions_owner_all on public.prescriptions;
drop policy if exists prescription_medications_owner_all on public.prescription_medications;
drop policy if exists medication_schedules_owner_all on public.medication_schedules;
drop policy if exists dose_logs_owner_all on public.dose_logs;
drop policy if exists refill_states_owner_all on public.refill_states;

create policy family_groups_select_members
on public.family_groups
for select
using (
  owner_user_id = public.current_user_id()
  or exists (
    select 1
    from public.family_group_memberships fgm
    where fgm.family_group_id = family_groups.id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
  )
);

create policy family_groups_insert_owner
on public.family_groups
for insert
with check (owner_user_id = public.current_user_id());

create policy family_groups_update_owner
on public.family_groups
for update
using (owner_user_id = public.current_user_id())
with check (owner_user_id = public.current_user_id());

create policy family_groups_delete_owner
on public.family_groups
for delete
using (owner_user_id = public.current_user_id());

create policy family_group_memberships_select_visible
on public.family_group_memberships
for select
using (
  exists (
    select 1
    from public.family_group_memberships self_membership
    where self_membership.family_group_id = family_group_memberships.family_group_id
      and self_membership.user_id = public.current_user_id()
      and self_membership.status = 'active'
  )
);

create policy family_members_member_access
on public.family_members
for select
using (
  exists (
    select 1
    from public.family_group_memberships fgm
    where fgm.family_group_id = family_members.family_group_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
  )
);

create policy family_members_caregiver_manage
on public.family_members
for insert
with check (
  added_by_user_id = public.current_user_id()
  and exists (
    select 1
    from public.family_group_memberships fgm
    where fgm.family_group_id = family_members.family_group_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
);

create policy family_members_caregiver_update
on public.family_members
for update
using (
  exists (
    select 1
    from public.family_group_memberships fgm
    where fgm.family_group_id = family_members.family_group_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
)
with check (
  exists (
    select 1
    from public.family_group_memberships fgm
    where fgm.family_group_id = family_members.family_group_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
);

create policy family_members_caregiver_delete
on public.family_members
for delete
using (
  exists (
    select 1
    from public.family_group_memberships fgm
    where fgm.family_group_id = family_members.family_group_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
);

create policy prescriptions_member_access
on public.prescriptions
for select
using (
  exists (
    select 1
    from public.family_members fm
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where fm.id = prescriptions.family_member_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
  )
);

create policy prescriptions_caregiver_manage
on public.prescriptions
for insert
with check (
  uploaded_by_user_id = public.current_user_id()
  and exists (
    select 1
    from public.family_members fm
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where fm.id = prescriptions.family_member_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
);

create policy prescriptions_caregiver_update
on public.prescriptions
for update
using (
  exists (
    select 1
    from public.family_members fm
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where fm.id = prescriptions.family_member_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
)
with check (
  exists (
    select 1
    from public.family_members fm
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where fm.id = prescriptions.family_member_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
);

create policy prescriptions_caregiver_delete
on public.prescriptions
for delete
using (
  exists (
    select 1
    from public.family_members fm
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where fm.id = prescriptions.family_member_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
);

create policy prescription_medications_member_access
on public.prescription_medications
for select
using (
  exists (
    select 1
    from public.prescriptions p
    join public.family_members fm on fm.id = p.family_member_id
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where p.id = prescription_medications.prescription_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
  )
);

create policy prescription_medications_caregiver_manage
on public.prescription_medications
for all
using (
  exists (
    select 1
    from public.prescriptions p
    join public.family_members fm on fm.id = p.family_member_id
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where p.id = prescription_medications.prescription_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
)
with check (
  exists (
    select 1
    from public.prescriptions p
    join public.family_members fm on fm.id = p.family_member_id
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where p.id = prescription_medications.prescription_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
);

create policy medication_schedules_member_access
on public.medication_schedules
for select
using (
  exists (
    select 1
    from public.family_members fm
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where fm.id = medication_schedules.family_member_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
  )
);

create policy medication_schedules_caregiver_manage
on public.medication_schedules
for all
using (
  exists (
    select 1
    from public.family_members fm
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where fm.id = medication_schedules.family_member_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
)
with check (
  exists (
    select 1
    from public.family_members fm
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where fm.id = medication_schedules.family_member_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
);

create policy dose_logs_member_access
on public.dose_logs
for select
using (
  exists (
    select 1
    from public.medication_schedules ms
    join public.family_members fm on fm.id = ms.family_member_id
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where ms.id = dose_logs.medication_schedule_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
  )
);

create policy dose_logs_caregiver_manage
on public.dose_logs
for all
using (
  exists (
    select 1
    from public.medication_schedules ms
    join public.family_members fm on fm.id = ms.family_member_id
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where ms.id = dose_logs.medication_schedule_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
)
with check (
  exists (
    select 1
    from public.medication_schedules ms
    join public.family_members fm on fm.id = ms.family_member_id
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where ms.id = dose_logs.medication_schedule_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
);

create policy refill_states_member_access
on public.refill_states
for select
using (
  exists (
    select 1
    from public.medication_schedules ms
    join public.family_members fm on fm.id = ms.family_member_id
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where ms.id = refill_states.medication_schedule_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
  )
);

create policy refill_states_caregiver_manage
on public.refill_states
for all
using (
  exists (
    select 1
    from public.medication_schedules ms
    join public.family_members fm on fm.id = ms.family_member_id
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where ms.id = refill_states.medication_schedule_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
)
with check (
  exists (
    select 1
    from public.medication_schedules ms
    join public.family_members fm on fm.id = ms.family_member_id
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where ms.id = refill_states.medication_schedule_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
);

create policy prescription_uploads_member_access
on public.prescription_uploads
for select
using (
  exists (
    select 1
    from public.prescriptions p
    join public.family_members fm on fm.id = p.family_member_id
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where p.id = prescription_uploads.prescription_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
  )
);

create policy prescription_uploads_caregiver_manage
on public.prescription_uploads
for all
using (
  exists (
    select 1
    from public.prescriptions p
    join public.family_members fm on fm.id = p.family_member_id
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where p.id = prescription_uploads.prescription_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
)
with check (
  exists (
    select 1
    from public.prescriptions p
    join public.family_members fm on fm.id = p.family_member_id
    join public.family_group_memberships fgm on fgm.family_group_id = fm.family_group_id
    where p.id = prescription_uploads.prescription_id
      and fgm.user_id = public.current_user_id()
      and fgm.status = 'active'
      and fgm.role in ('owner', 'caregiver')
  )
);

create policy notification_preferences_owner_all
on public.notification_preferences
for all
using (user_id = public.current_user_id())
with check (user_id = public.current_user_id());

insert into storage.buckets (id, name, public)
values ('prescriptions', 'prescriptions', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Renomedy prescription uploads private read" on storage.objects;
drop policy if exists "Renomedy prescription uploads private insert" on storage.objects;
drop policy if exists "Renomedy prescription uploads private update" on storage.objects;

create policy "Renomedy prescription uploads private read"
on storage.objects
for select
using (
  bucket_id = 'prescriptions'
  and split_part(name, '/', 1) = public.current_clerk_user_id()
);

create policy "Renomedy prescription uploads private insert"
on storage.objects
for insert
with check (
  bucket_id = 'prescriptions'
  and split_part(name, '/', 1) = public.current_clerk_user_id()
);

create policy "Renomedy prescription uploads private update"
on storage.objects
for update
using (
  bucket_id = 'prescriptions'
  and split_part(name, '/', 1) = public.current_clerk_user_id()
)
with check (
  bucket_id = 'prescriptions'
  and split_part(name, '/', 1) = public.current_clerk_user_id()
);
