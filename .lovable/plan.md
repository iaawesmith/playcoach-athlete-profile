
Rewire the AthleteLab Run Analysis tab to submit real analysis jobs through the production upload pipeline, while keeping the existing context form and simulated function deployed but no longer used by this tab.

### What will be built

1. Add reliable upload-to-result linkage
   - Add a nullable `upload_id uuid` column on `public.athlete_lab_results`
   - Add a foreign key from `athlete_lab_results.upload_id` to `athlete_uploads.id`
   - Update the production function’s results insert so each completed run writes `upload_id`
   - Use `upload_id` as the primary result lookup path in the UI
   - If no result row is found immediately after completion, keep a safe fallback query by athlete/node/time ordering for resilience

2. Add a backend helper for admin test submissions
   - Create a dedicated backend function for Run Analysis submissions
   - It will accept the node, signed video URL, timing, camera angle, and full `analysis_context`
   - It will insert into `athlete_uploads` using the fixed test athlete ID the user approved
   - This avoids client-side RLS issues and preserves the real webhook-triggered production path

3. Move Run Analysis uploads onto the real storage path
   - Change file uploads from `athlete-media/test-videos/*` to `athlete-videos/test-clips/*`
   - Use naming like `test-clips/{node-id}-{timestamp}.{ext}`
   - Generate a 24-hour signed URL after upload
   - Keep MIME-based file selection (`video/*`) so `.mp4`, `.mov`, and `.MOV` continue to work

4. Replace simulated submission in `TestingPanel`
   - Remove the tab’s dependency on `athlete-lab-analyze`
   - On submit:
     - upload local file if provided
     - create signed URL
     - call the new backend helper
     - receive the created `athlete_uploads.id`
   - Keep the existing Analysis Context inputs and forward them into `analysis_context`
   - Include `camera_angle`, `start_seconds`, and `end_seconds` in the real upload payload

5. Add real pipeline polling with clear states
   - Poll `athlete_uploads` by ID until `complete`, `failed`, or 240 seconds elapsed
   - Show distinct stages such as uploading, queued, processing, fetching results, complete, failed, and timed out
   - Make timeout messaging explicit: polling stopped after 240 seconds, but the pipeline may still be running and results may appear later
   - Keep retry available without clearing the entered context unnecessarily

6. Fetch and render real result data
   - After upload completion, fetch the linked `athlete_lab_results` row using `upload_id`
   - Replace the simulated result view with a real pipeline result view showing:
     - aggregate score
     - phase scores
     - full metric results
     - confidence flags
     - detected errors
     - feedback text
   - Surface calibration metadata per metric:
     - `calibrationSource`
     - `calibrationConfidence`
     - `calibrationDetails`
     - resolved `pixelsPerYard`
     - raw pixel value when present in detail

7. Improve result and error UX
   - Show `athlete_uploads.error_message` clearly when the pipeline fails
   - Distinguish upload/signing/backend submission failures from downstream pipeline failures
   - If polling times out, preserve the upload ID and show a “check later” state instead of a failure state
   - Keep the Analysis Log area compatible with the new flow, but do not block migration on log enhancements

### Files and systems to update

- `src/features/athlete-lab/components/TestingPanel.tsx`
- `src/services/athleteLab.ts`
- `src/features/athlete-lab/types.ts`
- `supabase/functions/analyze-athlete-video/index.ts` for `upload_id` on results writes only
- one new backend function for privileged admin test upload creation
- database migration for `athlete_lab_results.upload_id`

### Technical notes

- The `upload_id` addition is a small additive schema change and is worth including for reliable linkage
- No changes to metric calculations, calibration resolver logic, node config, or Cloud Run
- No changes to the existing Analysis Context form fields beyond passing them into the real upload flow
- The old `athlete-lab-analyze` function remains deployed for now but is no longer used by Run Analysis
- Storage policy may need a minimal adjustment if browser uploads to `athlete-videos/test-clips/*` are currently blocked by existing rules

### Validation after implementation

1. Run Analysis uploads land in `athlete-videos/test-clips/*`
2. Uploaded files get a 24-hour signed URL
3. Submitting creates a real `athlete_uploads` row through the backend helper
4. The webhook triggers the production pipeline
5. Polling shows correct intermediate states
6. Successful runs resolve a linked `athlete_lab_results.upload_id`
7. The UI shows real metric output including calibration metadata
8. Timeout state clearly says polling gave up, not that the pipeline failed
