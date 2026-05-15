alter table public.family_members
  add column if not exists name text,
  add column if not exists age integer check (age >= 0 and age <= 120),
  add column if not exists role text check (role in ('caregiver', 'patient', 'family_member')),
  add column if not exists avatar_url text,
  add column if not exists created_by uuid references public.users(id) on delete restrict,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;

update public.family_members
set
  name = coalesce(name, full_name),
  role = coalesce(role, case when is_primary_dependent then 'patient' else 'family_member' end),
  created_by = coalesce(created_by, added_by_user_id)
where name is null
   or role is null
   or created_by is null;

alter table public.family_members
  alter column name set not null,
  alter column role set not null,
  alter column created_by set not null;

drop trigger if exists trg_family_members_set_updated_at on public.family_members;
create trigger trg_family_members_set_updated_at
before update on public.family_members
for each row
execute function public.set_updated_at();

create index if not exists idx_family_members_group_archived
on public.family_members(family_group_id, is_archived);
