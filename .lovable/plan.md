

## Ticket 1: Unblock 6s+ clips with per-stage timing + targeted optimizations

### Pre-work: revert Slant node to draft

Migration: `UPDATE athlete_lab_nodes SET status='draft' WHERE id='75ed4b18-8a22-440e-9a23-b86204956056'` so users don't hit the broken RTMlib-schema indices (99, 120 on Hands Extension; break-angle [23,25,27] remap pending) before we ship the Ticket 1 fix.

### Diagnosis recap

Smoke test showed 3s clip → 23.4s, 6s clip → 503 after ~35–43s. The 6s clip exceeds Cloud Run's 60s default request timeout (or pushes close enough that the proxy 503s). Without per-stage numbers we're guessing whether the cost is in download, decode, auto-zoom probe, or the main pose loop. Note: `video.DOWNLOAD_TIMEOUT_SEC` is **already 120s** — option (b) from the user's brief is a no-op, dropping it.

`auto_zoom.decide_and_apply` runs at most 12 untimestamped `engine.detect()` calls (6 pre + 6 post). The main `run_with_skip` over a 6s clip at TARGET_FPS=30 and det_frequency=2 is ~90 detect calls. So the dominant cost is almost certainly the main pose loop, not auto-zoom. Per-stage timing will confirm.

### Changes

**1. `mediapipe-service/app/main.py` — per-stage timing**

Wrap each major stage in `time.perf_counter()` and emit a single structured `analyze done` log line with all stage durations. Add a separate Cloud Run `--timeout=300s` recommendation in the report (infrastructure config, not code).

Stages logged:
- `download_s` — `video.download_to_tmp` context entry
- `decode_s` — `decode_window`
- `autozoom_s` — `az.decide_and_apply`
- `pose_loop_s` — `run_with_skip`
- `reverse_map_s` — `az.reverse_map_landmarks`
- `calibration_s` — `calibration.estimate`
- `total_s` — end-to-end

Final log line shape:
```
analyze done frames=180 zoom=True ppy=80.2 download_s=2.31 decode_s=1.04 autozoom_s=3.85 pose_loop_s=27.40 reverse_map_s=0.01 calibration_s=0.12 total_s=34.73
```

**2. `mediapipe-service/app/auto_zoom.py` — configurable probe sample count**

Currently `SAMPLE_COUNT=6`. Make it configurable via env var `AUTOZOOM_SAMPLE_COUNT` (default 6, min 3, max 12). Lower default to **4** in code (still statistically reasonable for hip centroid + fill ratio on a steady clip; cuts probe cost ~33%).

Note: this addresses the user's option (a) — but rephrased. The user proposed "sample every Nth frame" which would only matter if the probe scanned all frames; it doesn't. The real probe lever is total sample count, not stride.

**3. `mediapipe-service/app/auto_zoom.py` — skip post-zoom probe when factor barely moves**

If `factor < 1.15`, the visual change is small enough that re-probing for safety backoff is wasted compute. Skip the post-pass; set `mean_conf_after = mean_conf_before` and `safety_backoff = False`. Saves up to 4 detect calls when zoom is marginal.

**4. (Dropped) urllib timeout bump**

`DOWNLOAD_TIMEOUT_SEC` is already 120s. No change needed.

### Out of scope (explicitly)

- `pose.py` — untouched
- Slant keypoint index remap (separate ticket after Ticket 1 validates)
- Replacing auto_zoom probe with segmentation mask — **acknowledged as Ticket 2 (next sprint), not planned here**
- Cloud Run service config (timeout, memory, concurrency) — recommendation reported separately; not code-level

### Files modified

- `supabase/migrations/<timestamp>_revert_slant_to_draft.sql` (1 line)
- `mediapipe-service/app/main.py` (add per-stage timers + structured final log)
- `mediapipe-service/app/auto_zoom.py` (env-configurable sample count, default lowered to 4; skip post-probe when factor<1.15)

### Validation plan (after redeploy)

1. Re-run two-call smoke test against upload `66ea5e98-…` (6s clip).
2. Read fresh Cloud Run log tail. Capture the new structured `analyze done` line with all stage timings.
3. Classify:
   - **GOOD** — both calls 200, total_s < 30s for 6s clip, stage breakdown shows `pose_loop_s` as dominant cost (confirming hypothesis). Pipeline reaches Slant scoring (which still fails on 99/120 — that's the next ticket).
   - **PARTIAL** — both calls 200, but total_s still > 30s. Stage timings tell us whether to escalate Cloud Run timeout, increase `det_frequency`, or move to Ticket 2 sooner.
   - **BAD** — still 503. Stage timings will pinpoint which stage hangs (most likely download or pose_loop). Capture and report.
4. Report includes: full Cloud Run log tail with the new timing line for each call, pose dimensions, mean confidence, calibration block, auto-zoom block, and a recommendation on whether Cloud Run timeout/memory needs bumping based on the actual numbers.

### Queue (confirmed)

1. ✅ Revert Slant to draft (this ticket, pre-work)
2. ✅ Ticket 1 (this plan): timing logs + auto_zoom probe trim
3. → Validate 6s works
4. → Slant keypoint index remap (separate ticket)
5. → Ticket 2 (next sprint): segmentation-mask probe replacing pose-based probe

