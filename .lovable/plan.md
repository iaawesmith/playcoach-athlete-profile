

## Plan: Bulletproof error recovery + cleanup

### Root cause (verified)

Two compounding bugs:

1. **`error_message` column doesn't exist** on `athlete_uploads`. Current schema only has: `id, athlete_id, node_id, node_version, video_url, start_seconds, end_seconds, camera_angle, status, created_at`. When the catch block calls `updateUploadStatus(id, 'failed', error.message)`, line 781 builds `{ status: 'failed', error_message: '...' }` → PostgREST rejects with "column does not exist" → the status update **never persists** → rows stay in `processing`.
2. `await req.json()` and `payload.record` at lines 9-10 sit **outside** the try block. A malformed webhook payload would crash before any status update could even be attempted.

### CHANGE 1 — Add `error_message` column (migration)

Without this column, no error-handling code can persist failure context. Single additive migration:

```sql
alter table public.athlete_uploads
  add column if not exists error_message text;
```

No defaults, no backfill, fully nullable, idempotent.

### CHANGE 2 — Harden the top-level handler

Edit `supabase/functions/analyze-athlete-video/index.ts` lines 8–96. Two structural changes:

**a) Move payload parsing inside try, capture `uploadId` in outer scope:**

```ts
Deno.serve(async (req) => {
  let uploadId: string | null = null

  try {
    const payload = await req.json()
    const upload = payload.record
    if (!upload?.id) {
      throw new Error('Invalid webhook payload: missing record.id')
    }
    uploadId = upload.id

    await updateUploadStatus(uploadId, 'processing')

    // ... STEPS 1–13 unchanged ...

    await updateUploadStatus(uploadId, 'complete')
    return new Response(JSON.stringify({ success: true }), { status: 200 })

  } catch (error) {
    const err = error as Error
    console.error('Pipeline error:', {
      uploadId,
      message: err.message,
      stack: err.stack,
    })

    if (uploadId) {
      try {
        await updateUploadStatus(uploadId, 'failed', err.message)
      } catch (updateErr) {
        console.error('Failed to mark upload as failed:', {
          uploadId,
          updateError: (updateErr as Error).message,
        })
      }
    }

    return new Response(
      JSON.stringify({ error: err.message, uploadId }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

Guarantees:
- `uploadId` is captured before any work that can throw, so the catch always knows which row to update.
- Status update inside catch is itself wrapped in try/catch — even if the DB write fails, the function still returns a clean 500 (no unhandled rejection).
- Full error including stack trace logged.
- Bad payloads (missing `record.id`) return 500 cleanly with no orphaned row (because no row was created/touched).

**b) Make `updateUploadStatus` log on failure** (small hardening so silent DB errors don't recur):

```ts
async function updateUploadStatus(uploadId: string, status: string, error?: string) {
  const { error: dbError } = await supabase
    .from('athlete_uploads')
    .update({ status, ...(error ? { error_message: error } : {}) })
    .eq('id', uploadId)
  if (dbError) {
    console.error('updateUploadStatus DB error:', { uploadId, status, dbError: dbError.message })
  }
}
```

### CHANGE 3 — Cleanup stuck rows

Live query found **4** stuck rows (one more than the user listed: `65bc2460-d95e-4df1-a74d-e5b089c0899e` from 20:17 UTC — also from earlier testing). I'll surface this and clean all four since they're all equivalent test debris. Run via insert/data tool (not migration — it's data, not schema):

```sql
update public.athlete_uploads
set status = 'failed',
    error_message = 'Cleanup: stuck in processing prior to error-handler fix'
where id in (
  'ecbf4cd8-89ce-4a69-989d-6b83036ead0a',
  '7ded7f5e-bd92-449a-8e4e-16e582fd20c7',
  'bcf5bab2-d572-4752-8be0-d0f16c7a4b92',
  '65bc2460-d95e-4df1-a74d-e5b089c0899e'
) and status = 'processing';
```

Run order matters: migration (adds column) → then the UPDATE (uses column).

### CHANGE 4 — Re-run E2E smoke test

Same approved sequence:

1. Confirm Slant Route is still `live`.
2. Capture `now()` marker.
3. INSERT spec row into `athlete_uploads`.
4. Wait 30s.
5. Pull `analyze-athlete-video` logs.
6. Read final row state — expect `status = 'failed'` AND `error_message` containing `RTMLIB_URL` and `pending_phase_2`.

### Verdict deliverable

```text
1. Webhook fires on INSERT              ✓/✗
2. Status → 'processing'                ✓/✗
3. Node config fetched                  ✓/✗
4. Preflight passed                     ✓/✗
5. Cloud Run call attempted & failed    ✓/✗  (mentions RTMLIB_URL)
6. Status → 'failed' (NOT stuck)        ✓/✗  (this is the new pass)
+ error_message column populated        ✓/✗
```

### What I will NOT do
- No edits to `RTMLIB_URL` (placeholder failure remains the expected Phase 1 result).
- No changes to pipeline steps 1–13, helpers, trigger, or UI.
- No changes to other tables.
- No retry logic (out of scope — separate concern).

### Files touched
- One new SQL migration (adds `error_message` column).
- `supabase/functions/analyze-athlete-video/index.ts` — handler + `updateUploadStatus` only.
- One data UPDATE for cleanup (run via insert tool, not migration).

### Risks
- Minimal. Column add is additive and nullable. Handler refactor preserves all 13 pipeline steps verbatim — only the wrapping changes.

