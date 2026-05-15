create table if not exists public.sanctuary_payments (
  id uuid primary key default gen_random_uuid(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  plan_slug text not null check (plan_slug in ('care', 'family_plus')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  razorpay_order_id text not null,
  razorpay_payment_id text,
  amount_inr integer not null,
  status text not null default 'pending' check (status in ('pending', 'captured', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (razorpay_order_id)
);

drop trigger if exists trg_sanctuary_payments_set_updated_at on public.sanctuary_payments;
create trigger trg_sanctuary_payments_set_updated_at
before update on public.sanctuary_payments
for each row
execute function public.set_updated_at();

alter table public.sanctuary_payments enable row level security;

create policy sanctuary_payments_owner_read
on public.sanctuary_payments
for select
using (user_id = public.current_user_id());

create index if not exists idx_sanctuary_payments_group_status
on public.sanctuary_payments(family_group_id, status);

create index if not exists idx_sanctuary_payments_user_created
on public.sanctuary_payments(user_id, created_at desc);
