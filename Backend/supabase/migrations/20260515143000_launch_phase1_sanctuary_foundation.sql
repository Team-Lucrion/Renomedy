alter table public.family_groups
  add column if not exists invite_expires_at timestamptz,
  add column if not exists plan_slug text not null default 'free',
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists subscription_expires_at timestamptz;

update public.family_groups
set invite_expires_at = coalesce(invite_expires_at, now() + interval '30 days')
where invite_expires_at is null;

alter table public.family_groups
  alter column invite_expires_at set not null;

alter table public.family_groups
  drop constraint if exists family_groups_plan_slug_check;

alter table public.family_groups
  add constraint family_groups_plan_slug_check
    check (plan_slug in ('free', 'care', 'family_plus'));

alter table public.family_groups
  drop constraint if exists family_groups_subscription_status_check;

alter table public.family_groups
  add constraint family_groups_subscription_status_check
    check (subscription_status in ('inactive', 'active', 'expired', 'cancelled', 'past_due'));

alter table public.users
  add column if not exists last_sanctuary_id uuid references public.family_groups(id) on delete set null;

alter table public.family_group_memberships
  drop constraint if exists family_group_memberships_role_check;

alter table public.family_group_memberships
  add constraint family_group_memberships_role_check
    check (role in ('owner', 'admin', 'caregiver', 'patient', 'family_member', 'viewer'));

alter table public.family_group_memberships
  drop constraint if exists family_group_memberships_status_check;

alter table public.family_group_memberships
  add constraint family_group_memberships_status_check
    check (status in ('active', 'invited', 'inactive'));

create index if not exists idx_users_last_sanctuary_id
on public.users(last_sanctuary_id);
