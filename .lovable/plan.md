
Manually validate the calibration resolver end-to-end by creating a fresh upload, but first address a backend blocker that prevents the requested `analysis_context` payload from flowing through the normal webhook path.

### What I found

- The analysis pipeline code in `supabase/functions/analyze-athlete-video/index.ts` expects `upload.analysis_context`.
- The live `public.athlete_uploads` table currently does **not** have an `analysis_context` column.
- Because of that, the exact test you requested cannot run through the normal insert/webhook flow yet: the upload row has nowhere to store `athlete_height`, so body-based calibration cannot be triggered from a real upload record.
- I also confirmed the Slant node exists and is live:
  - `id: 75ed4b18-8a22-440e-9a23-b86204956056`
  - `node_version: 4`
  - `reference_fallback_behavior: pixel_warning`
  - sideline static calibration currently has `pixels_per_yard: 80`

### Current implementation mismatch to verify during execution

There is also a likely metadata inconsistency in the deployed function:
- the new resolver code writes metric detail as:
  - `calibrationSource`
  - `calibrationConfidence`
  - `calibrationDetails`
- but recent stored `metric_results` still show older detail like `calibrationSource: "cloud_run_calibration"` on some metrics and missing the new structured fields on others

That means the deployed behavior should be verified carefully after the test run.

### Execution plan

1. Fix the upload schema so analysis context can be stored
   - Add `analysis_context jsonb` to `public.athlete_uploads`
   - Keep all existing rows compatible by making it nullable or defaulting to `{}`

2. Generate a fresh 24-hour signed URL for the reference clip
   - Reuse `athlete-videos/test-clips/slant-route-reference-v1.mp4`
   - Produce a new signed URL for `video_url`

3. Insert the test upload row
   - Use the Slant node ID you provided
   - Include:
     - `camera_angle: "sideline"`
     - `node_version`
     - `video_url`
     - `analysis_context` with `athlete_height`
   - Trigger analysis through the existing normal insert/webhook flow

4. Wait for pipeline completion
   - Poll `athlete_uploads` until the row reaches `complete` or `failed`
   - Allow up to the requested 240 seconds

5. Return the full inspection output
   - Final `athlete_uploads` row:
     - `id`
     - `status`
     - `error_message`
   - Matching `athlete_lab_results` row:
     - `id`
     - `node_version`
     - `athlete_id`
     - `aggregate_score`
     - full `phase_scores`
     - all metric entries in `metric_results`
   - For each metric, explicitly surface:
     - `calibrationSource`
     - `calibrationConfidence`
     - `calibrationDetails`
     - `pixelsPerYard`
     - raw pixel value where present
   - Retrieve the run’s `calibration_resolved` log event if available

### Technical details

Files/systems involved once execution is allowed:
- Database schema: `public.athlete_uploads`
- Runtime function: `supabase/functions/analyze-athlete-video/index.ts`
- Signed URL generation path already exists conceptually via storage signed URLs for `athlete-videos`

### Expected validation outcomes

After the schema blocker is removed and the test is run:
- If Cloud Run dynamic calibration succeeds, metrics should report `dynamic`
- If dynamic fails and `athlete_height` is present, the resolver should choose `body_based` when confidence is `>= 0.3`
- If height is absent or body-based confidence is too low, sideline static fallback should resolve to the node’s configured `pixels_per_yard: 80`
- The returned metric detail should reveal whether the deployed function is actually emitting the new structured calibration metadata consistently

### Why this needs approval

This task requires capabilities unavailable in the current read-only mode:
- database/schema change or at minimum a writable insert path
- signed URL generation
- inserting a live upload row
- waiting/polling the pipeline
- fetching result rows after execution

Once approved in writable mode, I can run the full test and return the exact output you asked for.
