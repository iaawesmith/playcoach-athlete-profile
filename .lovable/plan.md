
Current log retrieval is not sufficient to answer your four questions for the 2026-04-22 14:08 UTC run.

What I could confirm from the available backend logs:
- `analyze-athlete-video` currently exposes only:
  - `2026-04-22T14:06:18Z LOG booted (time: 24ms)`
  - `2026-04-22T14:09:38Z LOG shutdown`
- There are no execution-scoped log lines available for that run showing:
  - Cloud Run request/response payload summaries
  - phase window construction output
  - per-metric calculation traces
  - Claude call progress
  - result write confirmation

Why the logs are insufficient:
- In `supabase/functions/analyze-athlete-video/index.ts`, the function currently logs only:
  - top-level `console.error('Pipeline error:', ...)`
  - `console.error('Failed to mark upload as failed:', ...)`
  - `console.error('updateUploadStatus DB error:', ...)`
- `callCloudRun()` does not log successful responses.
- `buildPhaseWindows()` does not log computed windows.
- `calculateAllMetrics()` does not log per-metric inputs, skipped reasons beyond the returned result object, or why `value === null`.
- When a metric calculator returns `null`, the code records only:
  - `status: 'failed'`
  - `reason: 'calculation_failed'`
  with no deeper cause.
- That means the current codebase cannot produce the level of diagnosis you want from logs alone.

What this means for your specific questions:
1. Cloud Run response details  
   Not available in current logs. The code consumes `frame_count` and `fps`, but does not log them. It also does not log detected person count at all.

2. `buildPhaseWindows` output  
   Not available in current logs. The function computes windows from `totalFrames`, `proportion_weight`, and `frame_buffer`, but never logs the resulting frame ranges.

3. `calculateAllMetrics` failure reasons  
   Not available in current logs. The implementation only records a generic `calculation_failed` when a calculator returns `null`. There is no instrumentation telling whether failure came from:
   - missing person frames
   - missing keypoints
   - zero-length vectors
   - insufficient frames for temporal window
   - missing calibration
   - no velocity samples
   - failed event detection in `calculateFrameDelta`

4. Warnings/errors/unexpected output  
   None are visible for that execution window beyond boot/shutdown. The absence of detailed lines is itself the main diagnostic limitation.

Next change to make this diagnosable:
1. Add structured info logs around major pipeline steps:
   - upload start
   - node config loaded
   - preflight passed
   - Cloud Run request start / response summary
   - target person selection
   - phase window summary
   - metric calculation start/end
   - Claude request start/end
   - result write success
   - final status update

2. Add explicit Cloud Run success logging:
   - normalized RTMLIB URL used
   - `frame_count`
   - `fps`
   - inferred person count from first frame / max frame detections

3. Add `buildPhaseWindows` logging:
   - total frames
   - each phase id/name
   - computed `start` and `end`
   - source `proportion_weight`
   - `frame_buffer`

4. Add per-metric diagnostic logging inside `calculateAllMetrics()`:
   - metric id/name
   - calculation type
   - phase id
   - selected window range
   - keypoint indices
   - confidence result
   - failure reason before returning `calculation_failed`

5. Replace generic calculator nulls with explicit reasons where possible:
   - `no_person_frames`
   - `missing_keypoints`
   - `zero_magnitude_angle`
   - `insufficient_temporal_window`
   - `no_velocity_samples`
   - `anchor_event_not_found`
   - `target_event_not_found`

6. Redeploy and rerun one pipeline test, then pull the full logs again.

Expected result after that change:
- We will be able to answer exactly:
  - whether Cloud Run succeeded and what it returned
  - whether phase windows were correct
  - why each individual metric failed
  - whether Claude and results writing completed cleanly
