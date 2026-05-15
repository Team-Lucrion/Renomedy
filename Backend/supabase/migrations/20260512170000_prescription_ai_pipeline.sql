alter table public.prescriptions
  add column if not exists cleaned_ocr_text text,
  add column if not exists parsed_medicine_json jsonb,
  add column if not exists ai_provider text,
  add column if not exists ai_model text,
  add column if not exists ai_raw_response text;x
