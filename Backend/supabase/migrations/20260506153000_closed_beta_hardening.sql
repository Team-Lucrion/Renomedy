alter table public.prescriptions
  add column if not exists ocr_provider text,
  add column if not exists ocr_provider_metadata jsonb not null default '{}'::jsonb;

alter table public.prescription_uploads
  add column if not exists processing_status text not null default 'uploaded'
    check (processing_status in ('uploaded', 'ocr_pending', 'ocr_processed', 'upload_failed', 'ocr_failed')),
  add column if not exists last_error text,
  add column if not exists last_processed_at timestamptz;

alter table public.alerts
  add column if not exists dedupe_key text,
  add column if not exists failure_reason text,
  add column if not exists failed_at timestamptz,
  add column if not exists dismissed_at timestamptz;

create unique index if not exists idx_alerts_user_dedupe_key
on public.alerts(user_id, dedupe_key)
where dedupe_key is not null;

create index if not exists idx_prescription_uploads_processing_status
on public.prescription_uploads(processing_status);
