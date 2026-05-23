alter table public.prescription_medications
  add column if not exists strength text,
  add column if not exists dose text,
  add column if not exists quantity_purchased int,
  add column if not exists start_date date;
