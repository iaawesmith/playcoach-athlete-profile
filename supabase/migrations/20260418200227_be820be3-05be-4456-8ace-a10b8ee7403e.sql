alter table public.athlete_lab_results
  add column if not exists athlete_id uuid,
  add column if not exists aggregate_score integer,
  add column if not exists phase_scores jsonb not null default '{}'::jsonb,
  add column if not exists metric_results jsonb not null default '{}'::jsonb,
  add column if not exists feedback text not null default '',
  add column if not exists confidence_flags jsonb not null default '[]'::jsonb,
  add column if not exists detected_errors jsonb not null default '[]'::jsonb,
  add column if not exists analyzed_at timestamptz not null default now();

drop policy if exists "Allow all access to athlete_lab_results" on public.athlete_lab_results;

create policy "Service role can insert results"
  on public.athlete_lab_results for insert to service_role with check (true);

create policy "Service role can manage results"
  on public.athlete_lab_results for all to service_role using (true) with check (true);

create policy "Athletes can view their own results"
  on public.athlete_lab_results for select to authenticated
  using (auth.uid() = athlete_id);