update public.beta_invites
set status = 'used'
where used_by_user_id is not null
   or used_at is not null
   or coalesce(used_count, 0) > 0
   or status = 'used';

update public.beta_invites
set status = 'active'
where status in ('unused', 'approved')
  and used_by_user_id is null
  and used_at is null
  and coalesce(used_count, 0) = 0;

update public.beta_invites
set
  max_uses = 1,
  used_count = case when status = 'used' then 1 else 0 end;

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

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'beta_invites_single_use_max_uses_check'
      and conrelid = 'public.beta_invites'::regclass
  ) then
    alter table public.beta_invites drop constraint beta_invites_single_use_max_uses_check;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'beta_invites_single_use_count_check'
      and conrelid = 'public.beta_invites'::regclass
  ) then
    alter table public.beta_invites drop constraint beta_invites_single_use_count_check;
  end if;
end $$;

alter table public.beta_invites
  alter column status set default 'active';

alter table public.beta_invites
  add constraint beta_invites_status_check
  check (status in ('active', 'used', 'revoked'));

alter table public.beta_invites
  add constraint beta_invites_single_use_max_uses_check
  check (max_uses = 1);

alter table public.beta_invites
  add constraint beta_invites_single_use_count_check
  check (used_count in (0, 1));
