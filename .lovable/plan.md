

## Plan: Enable `pg_net` + seed vault secrets + re-run E2E test

### Migration (single SQL file)

**1. Install `pg_net` extension** in the standard `extensions` schema (Supabase convention — keeps `public` clean):
```sql
create extension if not exists pg_net with schema extensions;
```

**2. Seed the two vault secrets** the existing `trigger_analysis_on_upload()` function reads. Both are **idempotent** — insert if missing, update if present so values stay current with project secrets:
```sql
-- SUPABASE_URL
do $$
declare
  _url text := 'https://nwgljkjckcizbrpbqsro.supabase.co';
  _existing_id uuid;
begin
  select id into _existing_id from vault.secrets where name = 'SUPABASE_URL';
  if _existing_id is null then
    perform vault.create_secret(_url, 'SUPABASE_URL');
  else
    perform vault.update_secret(_existing_id, _url, 'SUPABASE_URL');
  end if;
end $$;

-- SUPABASE_SERVICE_ROLE_KEY (value pulled from project secrets at migration time)
do $$
declare
  _key text := '<<SERVICE_ROLE_KEY>>';  -- injected from project secrets
  _existing_id uuid;
begin
  select id into _existing_id from vault.secrets where name = 'SUPABASE_SERVICE_ROLE_KEY';
  if _existing_id is null then
    perform vault.create_secret(_key, 'SUPABASE_SERVICE_ROLE_KEY');
  else
    perform vault.update_secret(_existing_id, _key, 'SUPABASE_SERVICE_ROLE_KEY');
  end if;
end $$;
```
Note: the service role key value will be supplied at migration write time from the project's existing `SUPABASE_SERVICE_ROLE_KEY` secret. It is **not** hardcoded in chat or in the repo — it lives only inside the migration SQL submitted to the database. The `SUPABASE_URL` value is the public project URL (already visible in `client.ts`).

**3. Verify trigger references** — no change needed. Current `trigger_analysis_on_upload()` already reads from `vault.decrypted_secrets where name = 'SUPABASE_URL'` and `'SUPABASE_SERVICE_ROLE_KEY'`, and calls `net.http_post(...)`. Once the extension exists and secrets are seeded, the trigger works as-is. I'll confirm this post-migration with:
```sql
select pg_get_functiondef('public.trigger_analysis_on_upload'::regproc);
```

**4. Confirm trigger is actually attached** to `athlete_uploads` (the prior test failure suggests it is, since the INSERT ran the trigger and hit `schema "net" does not exist`). I'll verify with:
```sql
select tgname, tgrelid::regclass, tgenabled
from pg_trigger
where tgrelid = 'public.athlete_uploads'::regclass and not tgisinternal;
```
If missing, that's a separate problem and I'll surface it before proceeding to the test.

### Post-migration: re-run the E2E smoke test (unchanged from prior approved plan)

1. Re-confirm a `live` node exists.
2. Capture `now()` as test marker.
3. Run the spec INSERT into `athlete_uploads` (same SQL as before).
4. Wait 30 seconds for trigger → `pg_net` async HTTP → edge function execution.
5. Pull `analyze-athlete-video` logs filtered to the test window.
6. Read final `athlete_uploads` row state.

### Expected outcome
- INSERT succeeds, returns one `pending` row
- Logs show: webhook hit → status flips to `processing` → node config fetched → preflight OK → Cloud Run call attempted → fails on `RTMLIB_URL = 'pending_phase_2'`
- Final row status: `failed`
- Verdict table: each of the 6 expected steps marked ✓ or ✗ with evidence

### What I will NOT do
- No edits to `RTMLIB_URL` (placeholder failure IS the expected Phase 1 result)
- No changes to `trigger_analysis_on_upload()` definition
- No changes to the edge function, UI, or any other table
- No cleanup of the test row (you decide after review)

### Files touched
- One new SQL migration (extension + 2 vault upserts)

### Risk notes
- `pg_net` requires the `extensions` schema and is supported on Supabase by default — install should succeed.
- `vault.create_secret` / `vault.update_secret` are the supported Supabase Vault APIs; using them avoids touching `vault.secrets` directly.
- If a vault secret with the same name already exists with a different/stale value, the `update_secret` branch refreshes it — no duplicate-name conflict.

