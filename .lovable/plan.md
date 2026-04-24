## Edge Function fetch timeout fix for Cloud Run /analyze

### Diagnosis

Read `supabase/functions/analyze-athlete-video/index.ts:3110-3177`.

**Findings:**
1. **No explicit fetch timeout / AbortSignal.** The `callCloudRun()` function calls `fetch(rtmlibUrl, { method, headers, body })` with no `signal`. There is no `AbortController`, no `AbortSignal.timeout()`, no `setTimeout(controller.abort, …)`.
2. **Current effective value:** Deno's default. In Supabase Edge Runtime (Deno Deploy lineage), unbounded `fetch()` calls are subject to the runtime's per-request wall-clock and the platform's outbound idle timeout. Empirically the Call 1 `503` showed up at ~33s wall and the sandbox direct `curl` died at ~37s — both consistent with an upstream/proxy idle/header-wait cutoff well below Cloud Run's 600s budget. Either way: there is no explicit ceiling in our code, which means we cannot reason about it and cannot extend it without one.
3. The function then `await response.json()` — same socket, same implicit timeout window applies until the body is fully read.

So Cloud Run starts the analysis, the Edge Function's socket is closed by the runtime/proxy at ~28–33s, Cloud Run sees the cancel and logs "Shutting down". Classic short-client-timeout-on-long-server-job pattern.

### Fix (single-file, minimal)

`supabase/functions/analyze-athlete-video/index.ts` — modify `callCloudRun()` only.

1. Add a module-level constant near the top of the function:
   ```ts
   const CLOUD_RUN_FETCH_TIMEOUT_MS = 300_000 // 5 minutes
   ```
2. Wrap the `fetch` in an `AbortController` with a `setTimeout`, attach `signal`, and clear the timer in a `finally`:
   ```ts
   const controller = new AbortController()
   const timeoutId = setTimeout(() => controller.abort(), CLOUD_RUN_FETCH_TIMEOUT_MS)
   let response: Response
   try {
     response = await fetch(rtmlibUrl, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(requestPayload),
       signal: controller.signal,
     })
   } catch (err) {
     const isAbort = (err as Error).name === 'AbortError'
     throw new Error(
       isAbort
         ? `Cloud Run fetch timed out after ${CLOUD_RUN_FETCH_TIMEOUT_MS / 1000}s (RTMLIB_URL: ${rtmlibUrl})`
         : `Cloud Run fetch failed (RTMLIB_URL: ${rtmlibUrl}): ${(err as Error).message}`
     )
   } finally {
     clearTimeout(timeoutId)
   }
   ```
   The `clearTimeout` runs after the headers arrive. The body read (`response.json()`) is then unbounded relative to our timer — which is the right behavior, because once Cloud Run starts streaming the JSON we don't want to abort mid-stream.

   If we later see body-streaming hangs, we'd add a second timer around `response.json()`. Not doing that now — out of scope for this ticket.

3. No other changes to this function. `MEDIAPIPE_SERVICE_URL` resolution, payload shape, error messages, and `progress_updates` handling stay identical.

### What this does NOT touch

- `mediapipe-service/app/pose.py` — untouched
- `mediapipe-service/app/main.py` — untouched
- `mediapipe-service/app/auto_zoom.py` — untouched
- Cloud Run service config — untouched
- `supabase/config.toml` — untouched (function already deploys with the right defaults)
- Any other call site in the Edge Function — untouched (only `/analyze` is a long-running call; preflight and DB calls are millisecond-scale)

### Secondary concern (not fixed here, just noted for follow-up)

Sandbox `curl` direct-to-Cloud-Run died at ~37s. That's not the Edge Function — it's between the public client and Cloud Run's HTTPS frontend. Possible causes: Cloud Run ingress idle timeout for non-streaming responses, GFE/L7 LB's default idle, or a sandbox-side curl default. **Acknowledged as next-next-ticket** — diagnose only after this Edge Function fix unblocks the Edge-Function-initiated path. If the smoke test confirms 6s clips succeed via the Edge Function with the 300s timeout in place, the curl-from-sandbox issue is purely a debug-tool concern and may not need fixing at all.

### Validation plan after redeploy

Edge Function deploys automatically on commit. Then re-run the existing 3-turn smoke test path:

1. Reset upload `66ea5e98-…` to `pending`.
2. Invoke `analyze-athlete-video` (Call 1).
3. Capture: HTTP status, wall duration, the new structured `analyze done` log line with all six stage timings, response shape (frame_count, fps, keypoints dims, mean confidence), calibration block, auto-zoom block.
4. Reset to `pending`. Invoke again (Call 2). Same capture.
5. Validate decode_s extrapolation prediction: 1s baseline showed decode_s=3.62 → predicted ~22s for 6s clip. If actual decode_s scales roughly linearly, decode is the dominant scaler and the next lever for Ticket 2 is lowering `TARGET_FPS` from 30 → 15 in `video.py` (one line, ~50% cut on both decode and pose). If decode_s is sub-linear and pose_loop_s dominates, the lever is `det_frequency` or model size.
6. Classify GOOD / PARTIAL / BAD per the previously approved criteria.
7. Final migration: revert Slant node to `draft` AND reset upload to `pending`. End state matches pre-test exactly.

### Files modified

- `supabase/functions/analyze-athlete-video/index.ts` — `callCloudRun()` only, ~15 lines added/changed

No migrations, no service code, no config files.

### Queue (updated)

1. ✅ Slant flipped to `live` (Turn 1 of smoke test, still in effect)
2. ✅ Ticket 1 deployed (00010-gdp): per-stage timers + auto_zoom trim
3. → **This fix**: Edge Function fetch timeout 300s with AbortController
4. → Re-run smoke test (Call 1 + Call 2) with timing capture
5. → Final cleanup migration (Slant → draft, upload → pending)
6. → Slant keypoint index remap (separate ticket)
7. → Ticket 2 (data-driven, decided after smoke results): TARGET_FPS reduction OR segmentation-mask probe
8. → (Acknowledged) Sandbox-curl ingress timeout investigation, only if needed
