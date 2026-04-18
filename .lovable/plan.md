

## Plan: Align `athlete_lab_results` + verify service-role INSERT

### Migration (single SQL file)

**1. Add missing columns (additive, idempotent)**
```sql
alter table public.athlete_lab_results
  add column if not exists athlete_id uuid,
  add column if not exists aggregate_score integer,
  add column if not exists phase_scores jsonb not null default '{}'::jsonb,
  add column if not exists metric_results jsonb not null default '{}'::jsonb,
  add column if not exists feedback text not null default '',
  add column if not exists confidence_flags jsonb not null default '[]'::jsonb,
  add column if not exists detected_errors jsonb not null default '[]'::jsonb,
  add column if not exists analyzed_at timestamptz not null default now();
```
`athlete_id` stays nullable (table may already contain rows without it; spec's `not null` would fail). I'll note this for follow-up backfill.

**2. Replace insecure RLS**
```sql
drop policy if exists "Allow all access to athlete_lab_results" on public.athlete_lab_results;

create policy "Service role can insert results"
  on public.athlete_lab_results for insert to service_role with check (true);

create policy "Service role can manage results"
  on public.athlete_lab_results for all to service_role using (true) with check (true);

create policy "Athletes can view their own results"
  on public.athlete_lab_results for select to authenticated
  using (auth.uid() = athlete_id);
```

### Post-migration verification (per your addition)

Once migration succeeds, I will:

1. **Run a test INSERT** via `supabase--read_query`'s sibling write path (using a SQL execution that mirrors what the edge function does with its service-role client). The payload will match the `writeResults` shape from the edge function:
   ```sql
   insert into public.athlete_lab_results (
     athlete_id, node_id, node_version,
     aggregate_score, phase_scores, metric_results,
     feedback, confidence_flags, detected_errors,
     analyzed_at
   ) values (
     '00000000-0000-0000-0000-000000000001'::uuid,
     (select id from public.athlete_lab_nodes limit 1),
     1,
     82,
     '{"setup": 80, "execution": 85}'::jsonb,
     '{"hip_angle": {"value": 142, "target": 145, "score": 88}}'::jsonb,
     'Test feedback row — verifying service-role write path.',
     '[]'::jsonb,
     '[]'::jsonb,
     now()
   )
   returning id, athlete_id, aggregate_score, analyzed_at;
   ```
2. **Show you the returned row** so you can confirm column shape and defaults.
3. **Immediately delete it** by id:
   ```sql
   delete from public.athlete_lab_results where id = '<returned-id>';
   ```
4. **Confirm cleanup** with a `select count(*) where id = '<returned-id>'` returning 0.

Note on mechanics: migrations run as the migration role (superuser-equivalent), which also bypasses RLS just like service_role does. So the INSERT succeeding via SQL proves the column structure is correct and writes work; the new "Service role can insert results" policy is what unlocks the same operation when the edge function calls it through the PostgREST API. I'll call this out explicitly in the result.

### What I will NOT change
- No drops/renames of existing columns (`video_description`, `overall_score`, `result_data` preserved)
- No FK to `auth.users`
- No edge function or UI changes
- No other tables touched

### Files touched
- One new SQL migration

