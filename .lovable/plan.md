

## Plan: End-to-End Phase 1 Pipeline Smoke Test

### What I'll execute (in order)

**1. Pre-flight check** — confirm a live node exists so the INSERT's subselect won't be NULL:
```sql
select id, name, status from athlete_lab_nodes where status = 'live' limit 1;
```
If zero live nodes, I'll stop and surface that — the test can't proceed without one.

**2. Capture baseline log marker** — note the current timestamp so I can isolate this run's logs from prior noise:
```sql
select now() as test_started_at;
```

**3. Run the INSERT** exactly as specified:
```sql
insert into athlete_uploads (
  athlete_id, node_id, node_version,
  video_url, start_seconds, end_seconds,
  camera_angle, status
) values (
  gen_random_uuid(),
  (select id from athlete_lab_nodes where status = 'live' limit 1),
  1,
  'https://youtube.com/watch?v=Sz1G2wiyAIg',
  6, 11,
  'sideline',
  'pending'
)
returning id, athlete_id, node_id, status, created_at;
```
Capture the returned `id` — that's the row I'll track.

**4. Wait 30 seconds** for `trigger_analysis_on_upload` → `net.http_post` → edge function cold start → pipeline execution → status write-back.

**5. Pull edge function logs** for `analyze-athlete-video` and surface the full output for this execution (filtered to recent entries near the test_started_at timestamp).

**6. Read final row state**:
```sql
select id, status, created_at
from athlete_uploads
where id = '<returned-id>';
```

### Expected outcome (per spec)
- INSERT returns one row, status `pending`
- Logs show: webhook received → status `processing` → node config fetched → preflight OK → Cloud Run call attempted → fails because `RTMLIB_URL` is `pending_phase_2`
- Final row status: `failed` (with error context wherever the function writes it — note: `athlete_uploads` has no `error_message` column, so the function likely only sets `status='failed'`; the actual error will live in the function logs, not the row)

### What I'll NOT do
- No code changes, no migrations, no cleanup of the test row (you can decide whether to keep or delete it after reviewing)
- No changes to `RTMLIB_URL` — the placeholder failure IS the expected Phase 1 result
- No retry logic or follow-up inserts

### Files touched
None. This is purely a SQL + log-read execution; no migration or code edit is required.

### Deliverables I'll show you
1. The INSERT `RETURNING` row
2. Full `analyze-athlete-video` log output for this execution
3. The final `athlete_uploads` row state (status field)
4. A short verdict: did each of the 6 expected steps occur?

