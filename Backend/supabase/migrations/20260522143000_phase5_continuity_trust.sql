alter table public.prescriptions
  add column if not exists archive_status text not null default 'active',
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by_prescription_id uuid references public.prescriptions(id) on delete set null,
  add column if not exists archive_label text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.prescriptions
  drop constraint if exists prescriptions_archive_status_check;

alter table public.prescriptions
  add constraint prescriptions_archive_status_check
  check (archive_status in ('active', 'superseded', 'archived'));

alter table public.prescription_medications
  add column if not exists trust_metadata jsonb not null default '{}'::jsonb,
  add column if not exists continuity_status text not null default 'draft',
  add column if not exists replaced_by_medication_id uuid references public.prescription_medications(id) on delete set null,
  add column if not exists discontinued_at timestamptz,
  add column if not exists continuity_note text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.prescription_medications
  drop constraint if exists prescription_medications_continuity_status_check;

alter table public.prescription_medications
  add constraint prescription_medications_continuity_status_check
  check (continuity_status in ('draft', 'active', 'replaced', 'discontinued', 'superseded'));

alter table public.medication_schedules
  add column if not exists replaced_by_schedule_id uuid references public.medication_schedules(id) on delete set null,
  add column if not exists stopped_reason text,
  add column if not exists stopped_at timestamptz,
  add column if not exists continuity_note text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_prescriptions_archive_status
on public.prescriptions(family_member_id, archive_status);

create index if not exists idx_prescription_medications_continuity_status
on public.prescription_medications(prescription_id, continuity_status);

create index if not exists idx_medication_schedules_active_member
on public.medication_schedules(family_member_id, status)
where status = 'active';

drop trigger if exists trg_prescriptions_set_updated_at on public.prescriptions;
create trigger trg_prescriptions_set_updated_at
before update on public.prescriptions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_prescription_medications_set_updated_at on public.prescription_medications;
create trigger trg_prescription_medications_set_updated_at
before update on public.prescription_medications
for each row
execute function public.set_updated_at();

drop trigger if exists trg_medication_schedules_set_updated_at on public.medication_schedules;
create trigger trg_medication_schedules_set_updated_at
before update on public.medication_schedules
for each row
execute function public.set_updated_at();
