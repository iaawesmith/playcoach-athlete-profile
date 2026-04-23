
Implement a lightweight cancellation flow for admin test runs that marks the upload as cancelled, stops UI polling immediately, and makes the analysis function exit early at safe checkpoints.

### What will change

1. Add cancellation support to the upload status model
   - Extend the client types so `PipelineUploadStatus` includes `cancelled`
   - Extend `PipelineRunStage` with a matching `cancelled` stage
   - Update any status-label/icon/tone mappings that currently only handle pending, processing, complete, failed, and timed_out
   - Do a compatibility sweep for any UI/history components that render upload status so `cancelled` does not appear as a broken or unknown state

2. Add a backend helper to request cancellation
   - Create a focused Edge Function such as `admin-cancel-upload`
   - Accept `uploadId`
   - Validate input with Zod
   - Use service-role credentials
   - Load the upload row, verify it belongs to the fixed admin test athlete, and only allow cancellation when status is `pending` or `processing`
   - Update the row to `cancelled`
   - Return the normalized upload snapshot
   - Keep RLS unchanged by routing this status update through the backend helper rather than a client-side table update

3. Keep status reads on the existing backend-helper path
   - Reuse `admin-get-upload-status` so the UI continues reading status through the backend helper pattern
   - Ensure `cancelled` is returned cleanly by the existing normalization code in `src/services/athleteLab.ts`

4. Update the athleteLab service layer for cancellation
   - Add `cancelRunAnalysis(uploadId)` in `src/services/athleteLab.ts` to call the new backend helper
   - Update `pollRunAnalysisResult()` so if a polled upload comes back as `cancelled`, it exits immediately with stage `cancelled`
   - Preserve existing behavior for complete, failed, and timed_out
   - Keep the result fetch logic unchanged for completed runs only

5. Add a Cancel Run action in the Testing Panel
   - Show a `Cancel Run` button only when the active upload is in `pending` or `processing`
   - Disable the button while the cancel request is in flight
   - On click:
     - call the cancel helper
     - update `activeUpload`
     - set the stage to `cancelled`
     - stop any further polling updates from changing the UI back to processing
   - Add a clear cancelled-state presentation in the status panel and error/result area so the run feels intentionally stopped, not failed

6. Add early-exit cancellation checks inside `analyze-athlete-video`
   - Add a helper like `ensureNotCancelled(uploadId)` that reads the latest `athlete_uploads.status` using service-role access
   - Call it at safe checkpoints in the pipeline:
     - after switching to `processing`
     - after preflight
     - after Cloud Run returns
     - after metric calculation
     - before Claude
     - before writing results / before final completion update
   - If the upload is `cancelled`, stop early and return a non-error success response indicating cancellation
   - Do not write `athlete_lab_results` after cancellation
   - Do not overwrite `cancelled` with `failed` in the catch path

### Important implementation detail

The database column is already a text status field, so this may not require a schema migration unless an existing migration added an unseen check/constraint outside the surfaced schema. The implementation will verify that first; if a constraint exists, update it to allow `cancelled`. Otherwise, the change is code-level only.

### Files likely to change

- `src/features/athlete-lab/types.ts`
- `src/services/athleteLab.ts`
- `src/features/athlete-lab/components/TestingPanel.tsx`
- `supabase/functions/analyze-athlete-video/index.ts`
- `supabase/functions/admin-cancel-upload/index.ts`
- `supabase/config.toml` if the new helper needs an explicit function entry
- Possibly a migration file only if a status constraint needs expansion

### Behavior after implementation

1. User starts a test run as usual
2. While status is `pending` or `processing`, a `Cancel Run` button appears
3. Clicking it marks the upload row as `cancelled` through a backend helper
4. The UI immediately stops polling and switches to a polished cancelled state
5. The analysis function notices the cancelled status at the next checkpoint and exits without writing final results
6. RLS remains strict; no table policies are loosened

### Validation

1. Start a run and confirm the cancel button appears only for `pending`/`processing`
2. Click cancel and confirm the upload row status becomes `cancelled`
3. Confirm the UI stops polling immediately and shows `Cancelled`
4. Confirm the analysis function exits early once it reaches the next cancellation checkpoint
5. Confirm no `athlete_lab_results` row is written for a cancelled run
6. Confirm completed and failed runs still behave exactly as before
