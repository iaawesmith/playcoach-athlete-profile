
Implement a browser-first video preparation flow that removes unsupported FFmpeg work from the Edge Function, preserves cancellation, and makes Run Analysis feel live from the first second.

## What will change

### 1. Remove unsupported video transcoding from the Edge Function
Update `supabase/functions/analyze-athlete-video/index.ts` to stop using any subprocess-based video preparation.

Changes:
- Delete `prepareVideoForCloudRun()` and all `Deno.Command`, `Deno.makeTempDir`, `Deno.writeFile`, `Deno.readFile`, and storage re-upload logic tied to FFmpeg
- Pass `upload.video_url` directly to Cloud Run
- Keep all existing status updates, progress writes, result creation, and cancellation checkpoints intact
- Keep server-side progress messages focused on server work only:
  - `Loading model on server...`
  - `Processing frames X of Y...`
  - `Running calibration...`
  - `Calculating metrics...`
  - `Generating coaching feedback...`
  - `Writing analysis results...`
  - `Analysis complete`

This resolves the runtime error immediately and keeps the backend orchestration clean.

### 2. Add lightweight native browser-side 30fps decimation
Implement client-side preprocessing before upload in `src/services/athleteLab.ts`, using a native path first.

Primary approach:
- Hidden `HTMLVideoElement`
- `canvas.captureStream(30)`
- `MediaRecorder`

Behavior:
- Only preprocess local uploaded files, not pasted external URLs
- Normalize clips to 30fps before calling `admin-test-upload`
- Apply reasonable compression settings for short test clips
- Preserve the original filename pattern while marking the processed file clearly if needed
- Add feature detection and graceful fallback:
  - if native browser APIs are supported, use them
  - if they fail or the browser lacks required support, upload the original file unchanged and surface a clear non-blocking status message
- Do not add a heavy WASM package in this pass

Only if native testing shows clear quality/sync issues on common mobile browsers should a small fallback dependency be considered in a later iteration.

### 3. Extend the client run lifecycle with local progress stages
Expand the run-stage model so the UI can distinguish local work from server work.

Likely additions:
- `preparing_video`
- `uploading`
- existing `queued`
- existing `processing`
- existing `fetching_results`

Progress sequence:
```text
Compressing video to 30 fps...
Uploading video...
Queued for analysis...
Loading model on server...
Processing frames X of Y...
Running calibration...
Calculating metrics...
Generating coaching feedback...
Writing analysis results...
Analysis complete
```

This avoids the blank/generic feeling before backend polling begins.

### 4. Refactor the service layer to support preprocessing and cancellation
Update `src/services/athleteLab.ts` so submission handles native preprocessing and exposes progress cleanly to the UI.

Changes:
- Add a browser-side helper to preprocess a `File` to 30fps
- Add stage/progress callbacks to `submitRunAnalysisJob()`
- Keep `uploadTestClip()` as the upload helper, but make it upload the processed file when available
- Preserve existing polling behavior for `complete`, `failed`, `cancelled`, and `timed_out`
- Continue normalizing `progress_message` from the backend

Add practical cancellation behavior for the local phase:
- If the user cancels during local preprocessing or upload before an upload row exists, abort local work and transition cleanly to `cancelled`
- Once an upload row exists, use the existing `admin-cancel-upload` flow
- Ensure stale async work cannot overwrite a later cancelled state

### 5. Upgrade the Testing Panel progress experience
Update `src/features/athlete-lab/components/TestingPanel.tsx` to show meaningful progress from the moment the run starts.

Changes:
- Show local progress immediately:
  - `Compressing video to 30 fps...`
  - `Uploading video...`
- Then switch to backend-driven progress using `activeUpload.progress_message`
- Keep the segmented progress bar style already used in this panel
- Improve stage labels so they reflect the real current step instead of generic “Running production pipeline”
- Preserve the current Cancel button behavior and visibility during active local/server stages
- Keep the clean cancelled state with no results shown
- Ensure rerun/retry fully reset local progress, upload state, and error state

Progress source priority:
1. active local preprocessing/upload message
2. `activeUpload.progress_message`
3. fallback label from the current stage

### 6. Keep Cloud Run progress integration intact
Do not remove the progress-message architecture already added.

Ensure:
- `analyze-athlete-video` continues writing `progress_message` to `athlete_uploads`
- `callCloudRun()` still maps any returned `progress_updates` into `progress_message`
- frontend polling continues to display those updates in near real time

This preserves backward compatibility with the existing database column and admin status helpers.

## Files to update

### Frontend
- `src/features/athlete-lab/components/TestingPanel.tsx`
- `src/services/athleteLab.ts`
- `src/features/athlete-lab/types.ts`

### Backend
- `supabase/functions/analyze-athlete-video/index.ts`

### Likely unchanged
- `supabase/functions/admin-create-athlete-upload/index.ts`
- `supabase/functions/admin-get-upload-status/index.ts`
- `supabase/functions/admin-cancel-upload/index.ts`
- `supabase/migrations/20260423054423_c0314065-fdeb-4da4-bf1c-658dfe5bf448.sql`

## Technical details

### Native browser preprocessing design
Build a small utility around:
- object URL for the selected file
- off-DOM video element
- offscreen or hidden canvas
- canvas stream at 30fps
- MediaRecorder blob output
- conversion back to a `File`

Guardrails:
- short clips only, matching the current Athlete Lab test-run use case
- no dependency added unless native behavior proves unreliable
- preserve audio only if it is straightforward and stable; otherwise prioritize route-analysis utility and visual correctness over audio retention
- include timeout/error handling so preprocessing never traps the user in a dead state

### Cancellation model
Use a run token / abortable controller pattern in the client so:
- cancel during preprocessing stops frame pumping and recording
- cancel during upload prevents later completion callbacks from reviving the run
- backend cancellation remains unchanged after upload creation

### Backward compatibility
- existing `progress_message` column stays optional
- external video URLs still work
- complete/failed/cancelled/timed_out flows remain supported
- if preprocessing is unsupported, the run still proceeds with the original file rather than breaking submission

## Validation

1. Select a short local clip and verify the UI first shows `Compressing video to 30 fps...`
2. Confirm the UI then shows `Uploading video...`
3. Confirm the backend progress text appears once the upload is queued/processing
4. Confirm the Edge Function no longer triggers the subprocess runtime error
5. Confirm Cancel works:
   - during local preprocessing
   - during upload
   - during pending
   - during processing
6. Confirm cancelled runs show the clean cancelled state and no final results
7. Confirm external video URLs still bypass preprocessing and work as before
8. Test with a short ~6 second clip and verify the processed upload is reduced to a 30fps-equivalent browser-generated asset
9. Confirm overall runtime improves because Cloud Run receives the lower-frame-rate input
