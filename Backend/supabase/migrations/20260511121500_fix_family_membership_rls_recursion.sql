drop policy if exists family_group_memberships_select_visible
on public.family_group_memberships;

create policy family_group_memberships_select_own
on public.family_group_memberships
for select
using (
  user_id = public.current_user_id()
);
