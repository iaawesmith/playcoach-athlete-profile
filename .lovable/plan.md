## Ticket 2 — GFE streaming keepalive for /analyze (shipped)

**Status:** implemented and deployed.

Two files changed (no changes to `pose.py`, `auto_zoom.py`, `calibration.py`, `video.py`, or `schema.py`):

- `mediapipe-service/app/main.py` — `/analyze` now returns a `StreamingResponse` (NDJSON). An `asyncio.Queue` coordinates a `keepalive_loop` (yields `{"type":"keepalive"}` every 10s, `log.debug("keepalive yield")`) and a `run_pipeline` task that calls `_build_response` and emits a single `{"type":"result"}` or `{"type":"error"}` line. Both paths log `log.info("stream complete")` in `finally` before putting the SENTINEL.
- `supabase/functions/analyze-athlete-video/index.ts` — `callCloudRun` now consumes the NDJSON stream via `response.body.getReader()` + `TextDecoder`, ignores `keepalive` lines, captures `result`, throws on `error`. The 300s `AbortController` ceiling now bounds the entire stream lifetime. `logWarn` reused for parse failures.

API contract preserved: same `AnalyzeResponse` shape, delivered as the final line of the stream.

---

## Ticket 3 — 6-second clip support (deferred)

**Status:** deferred for launch. Clip window hard-capped at 3s in `main.py`
(`MAX_WINDOW_SECONDS = 3.0`), edge preflight (`MAX_CLIP_WINDOW_SECONDS = 3`,
new "Launch clip cap" check in `runPreflight`), and `TestingPanel.tsx` UI
(constant, default state, submit clamp, input min/max, helper text).

**Diagnosis (current run, upload 66ea5e98, 6s Slant clip):**
- Cloud Run instance dies mid-pose-loop ~2 minutes into processing.
- No `stream complete` log emitted from `run_pipeline()` finally block.
- No `analyze done` line.
- No FastAPI exception traceback.
- Container exits silently — consistent with SIGKILL from the platform
  (OOM or CPU throttle), not a Python-level crash.
- Keepalives were firing during the window (Ticket 2 working as designed) —
  the death is inside the pose loop, not a GFE timeout.

**Candidate fixes to investigate (separate session):**
1. Memory bump: Cloud Run instance from current limit to 16 GiB. Cheapest first try.
2. `TARGET_FPS` reduction in `video.py` from 30 → 15. Halves frame count fed
   to pose loop, roughly halves peak memory and pose-loop wall time.
   Trade-off: lower temporal resolution for metric calculations — needs
   validation against existing reference clips.
3. Pose loop chunking: process frames in batches of N with intermediate
   yields, instead of one synchronous `run_with_skip` call across all frames.
   Bounds peak memory regardless of clip length.

**Side effects to revisit when 6s unlocks:**
- Slant node `clip_duration_min` was lowered from **4 → 3** and
  `clip_duration_max` from **15 → 3** in the launch migration so the
  existing "Clip duration" preflight check would pass alongside the new
  "Launch clip cap" check. **This change is intentional and persistent.**
  When the 3s ceiling is removed, restore Slant's intended bounds (4–15s
  was the pre-launch config) or whatever the new product spec dictates.
- The TestingPanel input `min` is `Math.min(node.clip_duration_min, 3)`
  rather than raw `node.clip_duration_min` — same revisit point.

**Smoke test (post-deploy of Cloud Run):**
- Upload `66ea5e98-ff65-4d20-9e9e-232753d198aa` reset to
  `start_seconds=0, end_seconds=3, status='pending'` in the launch migration.
- Trigger is **manual** (no INSERT/UPDATE trigger added) — invoke
  `analyze-athlete-video` from terminal with the upload row as the
  webhook payload to start the run.

**Requires fresh debugging session** with Cloud Run console access for
memory/CPU graphs at the moment of kill.
