create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug in ('free', 'care', 'family_plus')),
  display_name text not null,
  monthly_price_inr integer not null default 0,
  yearly_price_inr integer,
  scan_limit_monthly integer,
  family_member_limit integer,
  reminder_limit integer,
  caregiver_alerts_enabled boolean not null default false,
  refill_prediction_enabled boolean not null default false,
  adherence_history_enabled boolean not null default false,
  premium_support_enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_subscription_plans_set_updated_at
before update on public.subscription_plans
for each row
execute function public.set_updated_at();

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  plan_slug text not null check (plan_slug in ('free', 'care', 'family_plus')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly', 'lifetime')),
  status text not null check (status in ('active', 'past_due', 'cancelled', 'expired')),
  source text not null default 'beta_manual' check (source in ('beta_manual', 'admin_manual', 'founder', 'payment_gateway')),
  started_at timestamptz not null default now(),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  gateway_customer_id text,
  gateway_subscription_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create trigger trg_user_subscriptions_set_updated_at
before update on public.user_subscriptions
for each row
execute function public.set_updated_at();

create table if not exists public.usage_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  prescription_scans_used integer not null default 0,
  reminders_created integer not null default 0,
  caregiver_alerts_used integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, period_start, period_end)
);

create trigger trg_usage_tracking_set_updated_at
before update on public.usage_tracking
for each row
execute function public.set_updated_at();

insert into public.subscription_plans (
  slug,
  display_name,
  monthly_price_inr,
  yearly_price_inr,
  scan_limit_monthly,
  family_member_limit,
  reminder_limit,
  caregiver_alerts_enabled,
  refill_prediction_enabled,
  adherence_history_enabled,
  premium_support_enabled,
  metadata,
  sort_order
)
values
  (
    'free',
    'Free',
    0,
    null,
    5,
    1,
    null,
    false,
    false,
    false,
    false,
    '{"cta":"Start Free","positioning":"Family Care Simplified","locked_features":["Caregiver alerts","Refill prediction","Adherence history","Multi-member coordination","Premium support"]}'::jsonb,
    10
  ),
  (
    'care',
    'Care',
    199,
    1999,
    null,
    3,
    null,
    true,
    true,
    true,
    false,
    '{"badge":"Most Popular","cta":"Protect Your Family","positioning":"Protect Your Family","primary_conversion":true}'::jsonb,
    20
  ),
  (
    'family_plus',
    'Family Plus',
    299,
    2999,
    null,
    10,
    null,
    true,
    true,
    true,
    true,
    '{"cta":"Coordinate Family Care","positioning":"Coordinate Full Family Care","multi_caregiver_coordination":true,"nri_family_management":true,"smart_escalation_alerts":true,"early_beta_ai_features":true}'::jsonb,
    30
  )
on conflict (slug) do update set
  display_name = excluded.display_name,
  monthly_price_inr = excluded.monthly_price_inr,
  yearly_price_inr = excluded.yearly_price_inr,
  scan_limit_monthly = excluded.scan_limit_monthly,
  family_member_limit = excluded.family_member_limit,
  reminder_limit = excluded.reminder_limit,
  caregiver_alerts_enabled = excluded.caregiver_alerts_enabled,
  refill_prediction_enabled = excluded.refill_prediction_enabled,
  adherence_history_enabled = excluded.adherence_history_enabled,
  premium_support_enabled = excluded.premium_support_enabled,
  metadata = excluded.metadata,
  sort_order = excluded.sort_order;

alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.usage_tracking enable row level security;

create policy subscription_plans_read_all
on public.subscription_plans
for select
using (is_active = true);

create policy user_subscriptions_owner_read
on public.user_subscriptions
for select
using (user_id = public.current_user_id());

create policy usage_tracking_owner_read
on public.usage_tracking
for select
using (user_id = public.current_user_id());

create index if not exists idx_user_subscriptions_user_id on public.user_subscriptions(user_id);
create index if not exists idx_user_subscriptions_plan_slug on public.user_subscriptions(plan_slug);
create index if not exists idx_usage_tracking_user_period on public.usage_tracking(user_id, period_start, period_end);
