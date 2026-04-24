

## Smoke test execution

Two-call smoke test against upload `66ea5e98-ff65-4d20-9e9e-232753d198aa` on warm revision `mediapipe-service-00009-dbr`. Validates singleton + VIDEO mode + cross-request timestamp monotonicity via `reserve_timestamp_range`.

### Sequence

1. Migration: `UPDATE athlete_uploads SET status='pending', error_message=NULL, progress_message=NULL WHERE id='66ea5e98-ff65-4d20-9e9e-232753d198aa'`
2. **Call 1** — invoke `analyze-athlete-video` with `{ type:'INSERT', table:'athlete_uploads', record:{ id:'66ea5e98-…' } }`. Capture invoke wall time.
3. Pull `mediapipe-service` Cloud Run log tail + `analyze-athlete-video` Edge Function logs for the Call 1 window.
4. Query `athlete_lab_results` (newest row for this upload) and `athlete_uploads` final state.
5. Same migration to reset to `pending`.
6. **Call 2** — same invocation, immediately after. Capture invoke wall time.
7. Pull Cloud Run + Edge Function logs for Call 2 window.
8. Query results + final state again.

### Per-call report

- HTTP status from Cloud Run `/analyze` (extracted from edge function log of the response)
- Cloud Run wall duration (edge function timing)
- `frame_count`, `fps`
- Keypoints dims `[F × 1 × 33 × 2]`, scores dims `[F × 1 × 33]`
- Mean keypoint confidence across all frames × landmarks
- Calibration: `source`, `confidence`, `pixels_per_yard`
- Auto-zoom: `applied`, `factor`, `crop_rect`
- Warnings
- `pipeline_result` written to `athlete_lab_results`? (row id, `aggregate_score`)
- Final `athlete_uploads.status`: `complete` / `failed` / stuck
- Exact error text + stack trace for index-out-of-bounds on indices 99/120
- Edge Function: clean rejection (`failed` + structured `error_message`) or uncaught 500

### Raw Cloud Run log tail (per call)

For each call, paste the unfiltered `mediapipe-service` log tail covering the window from `analyze start` through handler completion. Specifically extract the `timestamp_ms` values MediaPipe receives. Compare:

- Call 1: first and last timestamps passed to `detect_for_video`
- Call 2: first timestamp passed to `detect_for_video`

Pass condition: Call 2's first timestamp > Call 1's last timestamp. This proves `reserve_timestamp_range` is anchoring above prior request state.

If MediaPipe timestamps aren't directly logged today (the codebase doesn't currently log per-frame ts), report what's observable: the `analyze start` line, any auto-zoom log lines, the response line, and inferred ordering from request sequence + response success. If Call 2 succeeds with 200, monotonicity held; if it 503s with `Input timestamp must be monotonically increasing`, the fix didn't reach the actual call site.

### Classification

- **GOOD** — both calls 200 in 5–15s, real keypoints (mean confidence > 0.3), pipeline ends `failed` with clean index-out-of-bounds on 99/120 from Hands Extension at Catch metric. Singleton + VIDEO + cross-request monotonicity all validated.
- **PARTIAL** — both calls 200 in 5–15s, but mean confidence ≈ 0. Singleton fix works; clip quality is a separate ticket.
- **BAD** — either call 503/timeout, OR Call 2 fails with monotonicity error (would mean `auto_zoom`'s untimestamped detect path bypassed reservation). Capture exact stage and full log tail.

### Files modified

- One migration, run twice (between Call 1 and Call 2) to reset upload status.

No application code changes. No schema changes. Pure observation.

