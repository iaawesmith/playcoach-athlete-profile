
## Plan: Add a runtime-safe RTMLIB fallback in `analyze-athlete-video`, then rerun the pipeline test

### Code change to apply
Update `supabase/functions/analyze-athlete-video/index.ts` inside `callCloudRun()` so the function no longer hard-fails when `RTMLIB_URL` is missing in runtime.

### Proposed patch
```ts
const RTMLIB_FALLBACK =
  'https://rtmlib-service-874407535869.us-central1.run.app'

async function callCloudRun(payload: {
  video_url: string
  start_seconds: number
  end_seconds: number
  solution_class: string
  performance_mode: string
  det_frequency: number
  tracking_enabled: boolean
}): Promise<{
  keypoints: number[][][]
  scores: number[][][]
  frame_count: number
  fps: number
}> {
  const rtmlibBase = Deno.env.get('RTMLIB_URL')?.trim() || RTMLIB_FALLBACK
  const rtmlibUrl = rtmlibBase.replace(/\/+$/, '').endsWith('/analyze')
    ? rtmlibBase.replace(/\/+$/, '')
    : `${rtmlibBase.replace(/\/+$/, '')}/analyze`

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

### What this fixes
- If the runtime secret is missing or resolves empty, the function uses the hardcoded base URL.
- If the secret is set to the root service URL, the function appends `/analyze`.
- If the secret is already set to the full `/analyze` URL, the function keeps it unchanged.
- Error logs will continue to print the exact normalized URL actually used at runtime.

### Implementation notes
- Remove the current hard failure:
  ```ts
  if (!rtmlibUrl) {
    throw new Error('RTMLIB_URL not configured')
  }
  ```
- Keep the rest of the pipeline unchanged.
- No database changes.
- No config changes in `supabase/config.toml`.
- No changes to `admin-test-upload`.

### Deploy/verification sequence
1. Apply the above change to `supabase/functions/analyze-athlete-video/index.ts`.
2. Deploy the updated edge function.
3. Re-run the same end-to-end test flow:
   - confirm one live node exists
   - confirm the reference video exists
   - generate a fresh signed URL
   - insert a new `athlete_uploads` test row
   - wait 120 seconds
   - pull `analyze-athlete-video` logs
   - inspect final `athlete_uploads` row
   - inspect resulting `athlete_lab_results` row
4. Report the 10-step verdict again.

### Success criteria
A successful rerun should show:
1. insert succeeds
2. webhook fires
3. edge function starts
4. node config fetched
5. preflight passes
6. Cloud Run call succeeds using a normalized URL ending in `/analyze`
7. metrics calculated
8. Claude feedback generated
9. results written
10. `athlete_uploads.status = 'complete'`

### Primary diagnostic to report
The most important log evidence will be the runtime URL shown in the function logs:
- if it shows `.../analyze`, the normalization/fallback worked
- if it still fails, the error message will show the exact URL used, which narrows the next blocker immediately

### Files touched
- `supabase/functions/analyze-athlete-video/index.ts`
