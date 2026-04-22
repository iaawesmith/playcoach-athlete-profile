

## Plan: Phase 2 end-to-end pipeline test

### What runs (in order)

1. **Verify Live node** — `SELECT id, name, status FROM athlete_lab_nodes WHERE status = 'live' LIMIT 1;` (read_query). Capture `node_id` + `name` for later steps. Abort if zero rows.

2. **Verify reference video exists** — query `storage.objects` for `bucket_id = 'athlete-videos' AND name = 'test-clips/slant-route-reference-v1.mp4'`. Abort if not found.

3. **Generate 24-hour signed URL** — invoke the existing `admin-test-upload` edge function path won't work here (it expects a file upload). Instead, call a tiny one-shot via `supabase--curl_edge_functions` or — cleaner — use `supabase--read_query` is read-only and can't sign URLs. The right tool: invoke the Supabase Storage REST API directly via `curl` from `code--exec` using the service role key (`SUPABASE_SERVICE_ROLE_KEY` is in the secret list) against `POST /storage/v1/object/sign/athlete-videos/test-clips/slant-route-reference-v1.mp4` with `{"expiresIn": 86400}`. Capture the returned `signedURL` and prepend the project URL to form the absolute URL stored in `video_url`.

4. **Capture start timestamp** — `SELECT now() AS test_started_at;` (read_query). Used to filter edge function logs.

5. **INSERT athlete_uploads row** — this is a write, so it requires a migration tool call (the project doesn't have always-allow write access, and `read_query` is SELECT-only). The migration will:
   - `INSERT INTO public.athlete_uploads (athlete_id, node_id, node_version, video_url, start_seconds, end_seconds, camera_angle, status) VALUES (gen_random_uuid(), '<live_node_id>', 1, '<signed_url>', 0, 4, 'sideline', 'pending') RETURNING id, athlete_id, node_id, status, video_url, created_at;`
   - The `trigger_analysis_on_upload` trigger on this table fires `net.http_post` to `analyze-athlete-video` automatically. Capture `id` (upload_id) and `athlete_id` from the RETURNING clause for Steps 8–9.

6. **Wait 120 seconds** — `project_debug--sleep` is capped at 60 seconds, so I'll call it twice back-to-back. Cloud Run cold start + pose estimation + Claude call needs the full window.

7. **Pull edge function logs** — `supabase--edge_function_logs` for `analyze-athlete-video` (no search filter so I get the full window) plus a focused fetch with `search` set to the upload id captured in Step 5 to isolate this specific run. Also pull `admin-test-upload` logs are not needed (we bypassed it). If logs look thin, run `supabase--analytics_query` against `function_edge_logs` filtered by timestamp > `test_started_at`.

8. **Read final upload state** — `SELECT id, status, error_message, created_at FROM athlete_uploads WHERE id = '<upload_id>';` (read_query). Expect `status = 'complete'`.

9. **Read results row** — `SELECT id, athlete_id, node_id, aggregate_score, phase_scores, feedback, detected_errors, analyzed_at FROM athlete_lab_results WHERE athlete_id = '<athlete_id>' ORDER BY analyzed_at DESC LIMIT 1;` (read_query).

10. **Build verdict table** — render a 10-row markdown table mapping each expected pipeline step to a ✅/❌ outcome with the supporting evidence (log line, DB value, or error text). If any step is ❌, surface the exact error message and most relevant log excerpt for diagnosis.

### Mode requirements
- Read-only DB queries: covered by `supabase--read_query`.
- Edge function logs: covered by `supabase--edge_function_logs` and `supabase--analytics_query`.
- Sleep: covered by `project_debug--sleep` (twice).
- Signed URL generation via curl + service role key: needs `code--exec` (default mode).
- The `INSERT` into `athlete_uploads`: needs a migration (default mode).

So this entire test runs in **default mode**. Plan-mode approval flips us over.

### What I will report back
- Step 1 row (node id + name)
- Step 2 storage row confirmation
- Step 3 generated signed URL (truncated for safety, full value used internally)
- Step 4 `test_started_at` timestamp
- Step 5 INSERT RETURNING row
- Step 7 full edge function log output for the test window
- Step 8 final `athlete_uploads` row
- Step 9 `athlete_lab_results` row (or "not written" with reason)
- Step 10 verdict table (10 rows: pending → processing → node fetched → preflight → Cloud Run → metrics → Claude → results write → status = complete, plus webhook fire)

### What I will NOT do
- Will NOT modify any node config, secret, RLS policy, storage bucket settings, or edge function code.
- Will NOT delete the test row after the run — leaves it in place for your inspection.
- Will NOT re-upload the test video — relies on the existing object at `test-clips/slant-route-reference-v1.mp4`.
- Will NOT retry on failure — first failure surfaces the error and stops, since the goal is diagnosis, not recovery.

### Risks
- **Cloud Run cold start > 120s**: If the first invocation cold-starts beyond the wait window, the upload may still be `processing` at Step 8. I'll report that explicitly and recommend re-checking after another minute rather than declaring failure.
- **Signed URL via REST**: If the storage REST call fails (e.g., service role key scope issue), I'll fall back to inserting with a `supabase://` style internal path is not supported by `analyze-athlete-video`; in that case I'll surface the signing error and stop before Step 5 to avoid a guaranteed-failed pipeline run.
- **Trigger silently swallowed**: `trigger_analysis_on_upload` catches exceptions and logs a warning. If no edge function log appears within the window, I'll query `postgres_logs` for the warning to confirm whether the webhook even fired.

### Files touched
- One migration containing the single `INSERT … RETURNING` (auto-discarded read-only intent — it's a one-row test write into an existing table, no schema change).

