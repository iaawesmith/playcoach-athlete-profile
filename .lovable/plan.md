

## Re-run: End-to-End Phase 1 Pipeline Smoke Test

A live node now exists (Slant Route was promoted). Re-executing the previously-approved plan unchanged.

### Steps

1. **Confirm live node** — quick re-check:
   ```sql
   select id, name, status from athlete_lab_nodes where status = 'live' limit 1;
   ```

2. **Capture timestamp marker** for log filtering:
   ```sql
   select now() as test_started_at;
   ```

3. **Run the INSERT** exactly as specified:
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

4. **Wait 30 seconds** for trigger → `net.http_post` → edge function cold start → pipeline execution → status write-back.

5. **Pull `analyze-athlete-video` logs** for this execution window.

6. **Read final row state**:
   ```sql
   select id, status, created_at
   from athlete_uploads
   where id = '<returned-id>';
   ```

### Expected outcome
- INSERT returns one row, status `pending`
- Logs show: webhook received → status flips to `processing` → node config fetched → preflight OK → Cloud Run call attempted → fails because `RTMLIB_URL` is `pending_phase_2`
- Final row status: `failed`
- The function only writes `status` (no `error_message` column on `athlete_uploads`); the actual Cloud Run error string lives in the logs

### What I will NOT do
- No code, migrations, or schema changes
- No edits to `RTMLIB_URL` — placeholder failure IS the expected Phase 1 result
- No cleanup of the test row (you can decide after review)

### Files touched
None. Pure SQL + log read.

### Deliverables
1. INSERT `RETURNING` row
2. Full `analyze-athlete-video` log output for this execution
3. Final `athlete_uploads` row status
4. Verdict: did each of the 6 expected steps occur?

