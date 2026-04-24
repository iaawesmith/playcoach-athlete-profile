## Close-out: revert state + document streaming fix ticket

Three-turn smoke test ended at Turn 2 with diagnostic clarity. MediaPipe ran cleanly to ~26s into the 6s clip; SIGTERM at ~32s with no Python exception, no OOM, no Cloud Run 600s timeout hit. Root cause: **Google Front End (GFE) ~30s idle timeout** — FastAPI `/analyze` holds the full response until processing completes (~38s for a 6s clip), GFE drops the connection.

This plan does **not** implement the streaming fix. It restores pre-test state and documents the ticket for tomorrow.

### Step 1 — Single migration: revert Slant + reset upload

One migration file containing both UPDATEs:

```sql
UPDATE public.athlete_lab_nodes
SET status = 'draft'
WHERE id = '75ed4b18-8a22-440e-9a23-b86204956056';

UPDATE public.athlete_uploads
SET status = 'pending',
    error_message = NULL,
    progress_message = NULL
WHERE id = '66ea5e98-ff65-4d20-9e9e-232753d198aa';
```

### Step 2 — Verify end state

After migration applies, SELECT both rows and confirm:
- `athlete_lab_nodes` Slant row: `status = 'draft'`
- `athlete_uploads` test row: `status = 'pending'`, `error_message = NULL`, `progress_message = NULL`
- Nothing else touched. No code changes. No edge function redeploys. No Cloud Run revisions.

### Step 3 — Document Ticket 2 in `.lovable/plan.md`

Replace the current Edge Function timeout fix content (already deployed) with the new Ticket 2 spec:

**Ticket 2: GFE streaming keepalive for /analyze**

Problem: GFE drops Cloud Run connections after ~30s of zero response bytes. FastAPI `/analyze` returns one large JSON at the end, so any clip processing >30s wall time gets a 503 even though the container completes the work.

Evidence: 1s clip total_s=9.01 succeeds. 6s clip predicted total_s≈38s, observed SIGTERM at ~32s with no Python error and no OOM. `landmark_projection_calculator` warning at +26s confirms pose loop was actively running. The Edge Function 300s AbortController fix did NOT trigger — confirming the cutoff is upstream of our edge function, on the GFE→Cloud Run path.

Fix: Convert `/analyze` to `StreamingResponse` (NDJSON). Emit a small JSON keepalive line every ~10s during processing, then emit the final result line. Edge Function reads the stream, ignores keepalives, and parses the final line as `AnalyzeResponse`.

Pseudocode (for tomorrow — do not implement now):

```text
# main.py
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
        # existing analyze() body, but instead of returning,
        # push final result and sentinel to queue
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

    return StreamingResponse(stream(), media_type="application/x-ndjson")
```

```text
# supabase/functions/analyze-athlete-video/index.ts callCloudRun()
# Read response body line-by-line via response.body.getReader() + TextDecoder.
# Parse each line as JSON. Ignore {type:"keepalive"} lines.
# Parse {type:"result", data:{...}} as the AnalyzeResponse.
# Keep the existing 300s AbortController as a hard ceiling.
```

Validation plan for tomorrow:
1. Deploy streaming refactor to mediapipe-service.
2. Smoke test 1s clip — must still succeed with same `analyze done` log.
3. Smoke test 6s clip — expect success around total_s≈38s with keepalives visible in Cloud Run request logs.
4. If green, queue Slant keypoint index remap (Hands Extension idx 99/120, break-angle [23,25,27]) as Ticket 3.

Out of scope for this ticket: TARGET_FPS reduction, segmentation-mask probe, keypoint remap. Decide those after streaming is proven.

### Files modified

- One new migration file under `supabase/migrations/` containing the two UPDATE statements
- `.lovable/plan.md` — replace contents with Ticket 2 documentation above

No application code. No service redeploy. No edge function redeploy.
