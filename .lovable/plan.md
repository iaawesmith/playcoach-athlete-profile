

## Plan: Add missing `callCloudRun` helper + re-run E2E pipeline test

### The fix

The Edge Function calls `callCloudRun(...)` at line 32 of `supabase/functions/analyze-athlete-video/index.ts` but the helper is never defined — hence the `ReferenceError`. All other pipeline helpers (`callClaude`, `writeResults`, `updateUploadStatus`, `detectErrors`, `scoreMetric`, etc.) already exist in the file. This is a single, contained gap.

### Code addition

I'll add `callCloudRun` to `supabase/functions/analyze-athlete-video/index.ts`, placed alongside the other async network helpers (next to `callClaude`, around line ~700). The implementation matches the spec you provided exactly:

```ts
async function callCloudRun(payload: {
  video_url: string
  start_seconds: number
  end_seconds: number
  solution_class: string
  performance_mode: string
  det_frequency: number
  tracking_enabled: boolean
}) {
  const rtmlibUrl = Deno.env.get('RTMLIB_URL')
  if (!rtmlibUrl) {
    throw new Error('RTMLIB_URL not configured')
  }

  let response: Response
  try {
    response = await fetch(rtmlibUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    throw new Error(
      `Cloud Run fetch failed (RTMLIB_URL: ${rtmlibUrl}): ${(err as Error).message}`
    )
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '')
    throw new Error(
      `Cloud Run call failed: ${response.status} ${response.statusText} ` +
      `(RTMLIB_URL: ${rtmlibUrl})${bodyText ? ` — ${bodyText.slice(0, 200)}` : ''}`
    )
  }

  return await response.json() as {
    keypoints: number[][][]
    scores: number[][][]
    frame_count: number
    fps: number
  }
}
```

Behavior matches your spec:
1. Typed payload with all 7 required fields.
2. Reads `RTMLIB_URL` from env.
3. POSTs JSON with `Content-Type: application/json`.
4. Returns parsed JSON typed as `{ keypoints, scores, frame_count, fps }`.
5. Every error path mentions `RTMLIB_URL` (and its current value) so Phase 2 dependency is obvious in logs.

The `fetch` is wrapped in try/catch separately from the `response.ok` check — this distinguishes "URL unreachable / DNS failure" (which is what will happen when `RTMLIB_URL = 'pending_phase_2'`) from "Cloud Run returned non-2xx".

### Expected behavior after deploy

With `RTMLIB_URL` currently set to the placeholder string `'pending_phase_2'`:
- `Deno.env.get('RTMLIB_URL')` returns `'pending_phase_2'` (truthy → no early throw)
- `fetch('pending_phase_2', ...)` throws because it's not a valid URL
- The catch block re-throws: `Cloud Run fetch failed (RTMLIB_URL: pending_phase_2): ...`
- Main pipeline catch sets `athlete_uploads.status = 'failed'` with that error message

This is the expected Phase 1 terminal state.

### Re-run E2E test (after deploy)

Same approved flow as before:
1. Confirm a `live` node exists (Slant Route).
2. Capture `now()` marker.
3. INSERT into `athlete_uploads` (same SQL as the original spec).
4. Wait 30 seconds.
5. Pull `analyze-athlete-video` logs for this window.
6. Read final `athlete_uploads` row state.

### Verdict deliverable

A 6-row table marking each pipeline step ✓ or ✗:

```text
1. Webhook fires on INSERT          ✓/✗
2. Status → 'processing'             ✓/✗
3. Node config fetched               ✓/✗
4. Preflight passed                  ✓/✗
5. Cloud Run call attempted & failed ✓/✗  (must mention RTMLIB_URL)
6. Status → 'failed'                 ✓/✗
```

### What I will NOT do
- No edits to `RTMLIB_URL` (placeholder failure IS the expected result).
- No changes to any other helper, the trigger, the DB, or the UI.
- No cleanup of test rows — you decide after review.

### Files touched
- `supabase/functions/analyze-athlete-video/index.ts` — single insertion of `callCloudRun` function.

### Risks
- Minimal. Net-new helper with no callers other than the existing line 32 invocation. No type changes to the pipeline. No schema changes.

