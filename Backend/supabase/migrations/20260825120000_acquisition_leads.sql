create table if not exists public.acquisition_leads (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_url text,
  public_handle text,
  contact_channel text not null default 'manual',
  name text,
  city text,
  caregiver_type text,
  care_context text,
  medicine_complexity smallint not null default 0 check (medicine_complexity between 0 and 2),
  prescription_confusion boolean not null default false,
  reminder_refill_problem boolean not null default false,
  feedback_willing boolean not null default false,
  referral_likelihood boolean not null default false,
  consent_status text not null default 'research_only' check (consent_status in ('research_only', 'opted_in', 'do_not_contact')),
  status text not null default 'researched' check (status in ('researched', 'qualified', 'awaiting_approval', 'approved', 'contacted', 'replied', 'qualified_conversation', 'beta_invited', 'beta_redeemed', 'first_upload', 'won', 'lost', 'do_not_contact')),
  priority_score smallint not null default 0 check (priority_score between 0 and 10),
  research_summary text,
  outreach_draft text,
  founder_notes text,
  approval_status text not null default 'not_required' check (approval_status in ('not_required', 'pending', 'approved', 'rejected')),
  approved_at timestamptz,
  contacted_at timestamptz,
  last_response_at timestamptz,
  next_follow_up_at timestamptz,
  beta_invite_id uuid references public.beta_invites(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists acquisition_leads_priority_idx
  on public.acquisition_leads (priority_score desc, next_follow_up_at asc nulls last);

create index if not exists acquisition_leads_status_idx
  on public.acquisition_leads (status, approval_status, created_at desc);

create unique index if not exists acquisition_leads_source_handle_idx
  on public.acquisition_leads (source, public_handle)
  where public_handle is not null;

create unique index if not exists acquisition_leads_source_url_idx
  on public.acquisition_leads (source, source_url)
  where source_url is not null;

alter table public.acquisition_leads enable row level security;
