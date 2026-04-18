alter table public.athlete_uploads
  add column if not exists error_message text;