## Ticket 2: GFE streaming keepalive for /analyze

### Status

Queued for tomorrow. Smoke test from prior session ended with diagnostic clarity but not a working 6s clip. State has been reverted: Slant node = `draft`, test upload `66ea5e98-…` = `pending`.

### Problem

Google Front End (GFE) drops Cloud Run connections after ~30s of zero response bytes. FastAPI `/analyze` returns one large JSON at the end, so any clip processing >30s wall time gets a 503 even though the container completes the work.

### Evidence

- 1s clip: `total_s=9.01` succeeds end-to-end, returns 200.
- 6s clip (predicted `total_s≈38s`): observed SIGTERM at ~32s with no Python exception, no OOM, and Cloud Run's own request budget (600s) nowhere near exhausted.
- `landmark_projection_calculator` warning at +26s into the request confirms the pose loop was still actively running when the connection dropped.
- The Edge Function 300s `AbortController` fix (already shipped) did NOT trigger — confirming the cutoff is upstream of our edge function, on the GFE → Cloud Run path. That fix stays in place as a hard ceiling but is not the bottleneck.

### Fix

Convert `/analyze` to `StreamingResponse` (NDJSON). Emit a small JSON keepalive line every ~10s during processing so GFE keeps the socket open, then emit the final result line at the end. Edge Function reads the stream, ignores keepalives, parses the final line as `AnalyzeResponse`. API contract is preserved at the semantic level; transport changes from single-shot JSON to NDJSON stream.

### Pseudocode (do not implement until tomorrow)

`mediapipe-service/app/main.py`:

```text
from fastapi.responses import StreamingResponse
import json, asyncio, time

@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    yield_queue: asyncio.Queue = asyncio.Queue()

    async def keepalive_loop():
        while True:
            await asyncio.sleep(10)
            await yield_queue.put({"type": "keepalive", "ts": time.time()})

    async def run_pipeline():
        # existing analyze() body, but instead of `return response`,
        # push final result and sentinel into the queue
        ...
        await yield_queue.put({"type": "result", "data": response.dict()})
        await yield_queue.put(None)  # sentinel

    async def stream():
        pipeline_task = asyncio.create_task(run_pipeline())
        keepalive_task = asyncio.create_task(keepalive_loop())
        try:
            while True:
                item = await yield_queue.get()
                if item is None:
                    break
                yield (json.dumps(item) + "\n").encode()
        finally:
            keepalive_task.cancel()
            # let pipeline_task finish or cancel cleanly on client disconnect

    return StreamingResponse(stream(), media_type="application/x-ndjson")
```

`supabase/functions/analyze-athlete-video/index.ts` — `callCloudRun()`:

```text
# Keep existing 300s AbortController as hard ceiling.
# Replace `await response.json()` with line-by-line read:
#   const reader = response.body!.getReader()
#   const decoder = new TextDecoder()
#   let buf = ''
#   let final: AnalyzeResponse | null = null
#   while (true) {
#     const { value, done } = await reader.read()
#     if (done) break
#     buf += decoder.decode(value, { stream: true })
#     const lines = buf.split('\n')
#     buf = lines.pop() ?? ''
#     for (const line of lines) {
#       if (!line.trim()) continue
#       const msg = JSON.parse(line)
#       if (msg.type === 'keepalive') continue
#       if (msg.type === 'result') final = msg.data
#     }
#   }
#   if (!final) throw new Error('Cloud Run stream ended without result')
#   return final
```

### Validation plan

1. Deploy streaming refactor to mediapipe-service.
2. Smoke test 1s clip — must still succeed with same `analyze done` log line and same response shape.
3. Smoke test 6s clip — expect success around `total_s≈38s` with keepalive lines visible in Cloud Run request logs.
4. If green, queue Slant keypoint index remap (Hands Extension idx 99/120, break-angle [23, 25, 27]) as Ticket 3.

### Out of scope for this ticket

- TARGET_FPS reduction (Ticket 4 candidate, decide after streaming is proven)
- Segmentation-mask probe optimization
- Slant keypoint remap (Ticket 3)
- Sandbox-curl ingress investigation (debug-tool concern only)

### Queue (updated)

1. ✅ Ticket 1 deployed (00010-gdp): per-stage timers + auto_zoom trim
2. ✅ Edge Function 300s AbortController shipped (didn't fix the issue but is correct hardening)
3. ✅ Smoke test closed cleanly: Slant → draft, upload → pending
4. → **Ticket 2** (this doc): GFE streaming keepalive in `/analyze`
5. → Re-run 6s smoke test, classify GOOD / PARTIAL / BAD
6. → Ticket 3: Slant keypoint index remap (99 / 120 / [23,25,27])
7. → Ticket 4 (data-driven): TARGET_FPS reduction OR segmentation-mask probe
