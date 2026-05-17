alter table public.beta_invites
  add column if not exists code text,
  add column if not exists name text,
  add column if not exists status text,
  add column if not exists max_uses integer not null default 1,
  add column if not exists used_count integer not null default 0,
  add column if not exists used_at timestamptz;

update public.beta_invites
set code = coalesce(code, invite_code)
where code is null;

update public.beta_invites
set invite_code = coalesce(invite_code, code)
where invite_code is null;

update public.beta_invites
set status = 'unused'
where status is null;

update public.beta_invites
set
  status = case
    when status = 'approved' then 'unused'
    when status = 'consumed' then 'used'
    when status = 'revoked' then 'revoked'
    else status
  end
where status in ('approved', 'consumed', 'revoked');

update public.beta_invites
set
  used_count = case
    when status = 'used' or used_by_user_id is not null then greatest(used_count, 1)
    else used_count
  end,
  used_at = coalesce(used_at, created_at)
where status = 'used' or used_by_user_id is not null;

alter table public.beta_invites
  alter column status set not null;

alter table public.beta_invites
  alter column code set not null;

alter table public.beta_invites
  alter column status set default 'unused';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'beta_invites_email_or_phone_or_clerk_user_id_check'
      and conrelid = 'public.beta_invites'::regclass
  ) then
    alter table public.beta_invites drop constraint beta_invites_email_or_phone_or_clerk_user_id_check;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'beta_invites_status_check'
      and conrelid = 'public.beta_invites'::regclass
  ) then
    alter table public.beta_invites drop constraint beta_invites_status_check;
  end if;
end $$;

alter table public.beta_invites
  add constraint beta_invites_status_check
  check (status in ('unused', 'used', 'revoked'));

create unique index if not exists idx_beta_invites_code on public.beta_invites(code);

alter table public.users
  add column if not exists beta_access_approved boolean not null default false,
  add column if not exists beta_invite_code_used text,
  add column if not exists beta_approved_at timestamptz;

update public.users
set
  beta_access_approved = coalesce(beta_access_approved, beta_access_status = 'active'),
  beta_invite_code_used = coalesce(beta_invite_code_used, (
    select bi.code
    from public.beta_invites bi
    where bi.id = users.beta_invite_id
    limit 1
  )),
  beta_approved_at = coalesce(beta_approved_at, beta_access_granted_at)
where true;

create index if not exists idx_users_beta_access_approved on public.users(beta_access_approved);
