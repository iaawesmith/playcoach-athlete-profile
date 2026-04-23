
Implement metric-aware temporal smoothing in `supabase/functions/analyze-athlete-video/index.ts` by replacing the current global moving-average helper with a confidence-aware, node-driven version that runs once immediately after Cloud Run returns raw pose data.

## What will change

### 1. Replace the existing smoothing helper with the required signature
Update the current `applyTemporalSmoothing(keypoints, windowSize = 3)` helper to:

- use the required signature:
  - `applyTemporalSmoothing(keypoints, scores, nodeConfig)`
- return the same `VideoKeypoints` shape as input
- stay fully backward-compatible with the rest of the pipeline

Why this is needed:
- the current helper already exists, but it:
  - smooths every keypoint indiscriminately
  - ignores confidence scores
  - ignores metric-specific `temporal_window`
  - does not interpolate low-confidence gaps
- the pipeline currently calls it with only `keypoints`, so it does not satisfy the requested behavior

### 2. Build a metric-aware smoothing configuration from node metrics
Inside the helper, derive the set of keypoints that should be smoothed from `nodeConfig.key_metrics`:

- inspect each metric’s `keypoint_mapping`
- collect every referenced `keypoint_index`
- track per-keypoint smoothing settings across all metrics that use it:
  - smoothing window = max of metric `temporal_window`, with minimum 3
  - confidence threshold = the strictest practical threshold for that keypoint based on metrics using it

This keeps smoothing focused only on keypoints that actually affect scoring.

### 3. Add low-confidence interpolation before averaging
For each tracked keypoint and coordinate stream (`x`, `y`):

- inspect frame-by-frame confidence from `scores`
- mark frames below the chosen confidence threshold as unreliable
- for unreliable runs with a max gap of 5 frames:
  - linearly interpolate between neighboring good frames
- if a low-confidence gap has no valid neighbors or exceeds 5 frames:
  - leave original values unchanged for that gap

This reduces jitter while avoiding invented motion across long missing spans.

### 4. Apply moving-average smoothing on the repaired timeseries
After interpolation:

- run a centered moving average on each keypoint’s X and Y values
- use the derived window for that keypoint
- enforce minimum window size of 3
- preserve original coordinates for frames/persons/keypoints that cannot be safely processed

This should stabilize velocity, acceleration, and angle-derived metrics without changing pipeline outputs structurally.

### 5. Keep smoothing scoped cleanly to the current pipeline
Update the run flow right after Cloud Run returns:

Current flow already has:
- Cloud Run response
- temporal smoothing step
- target-person lock
- calibration
- metric calculation

Refine that step so it becomes:
- `const smoothedKeypoints = applyTemporalSmoothing(rtmlibResult.keypoints, rtmlibResult.scores, nodeConfig)`
- continue using:
  - `smoothedKeypoints`
  - original `rtmlibResult.scores`

Everything downstream should continue using the smoothed keypoints:
- person lock
- tracked-person isolation
- calibration
- phase segmentation
- metric calculations
- scoring
- error detection
- Claude decision/feedback
- results writing

### 6. Add the required logging
Emit a clear log entry after smoothing completes:

`Applied temporal smoothing (window = X frames) for Y keypoints`

Recommended logging details:
- upload ID
- number of unique smoothed keypoints
- representative/default window used
- per-keypoint window map if helpful

Keep existing progress/status behavior intact. Do not remove or rename current progress messages unless needed to keep them accurate.

## Files to update

- `supabase/functions/analyze-athlete-video/index.ts`

## Implementation details

### Helper behavior
Use these rules inside `applyTemporalSmoothing`:

- only process keypoints referenced by metrics
- iterate frame-by-frame and person-by-person so multi-person clips remain structurally compatible
- use `scores[frame][person][keypointIndex]` to decide whether a frame is reliable
- interpolation rule:
  - only fill gaps when both left and right neighbors are reliable
  - only if gap length `<= 5`
- moving average rule:
  - centered window
  - minimum 3
  - ignore invalid/missing points in the averaging pool
  - fall back to original/interpolated point when too few valid neighbors exist

### Minimality
Keep the change isolated:
- no schema changes
- no frontend changes
- no changes to Cloud Run
- no changes to cancellation logic
- no changes to Claude logic
- no changes to results shape

### Backward compatibility
Preserve all current behavior for:
- completed runs
- failed runs
- cancelled runs
- progress messages
- result writing
- low-confidence / Pose Quality Audit flow

Only the coordinate stream feeding the metric engine should become cleaner.

## Validation

1. Run a test with the Slant node
2. Confirm the function logs include:
   - `Applied temporal smoothing (window = X frames) for Y keypoints`
3. Confirm the pipeline still completes successfully end-to-end
4. Compare metric stability before/after on a short phone-footage clip, especially:
   - velocity
   - acceleration
   - angle metrics affected by frame jitter
5. Confirm cancel still works normally during processing
6. Confirm no regressions in progress logging, scoring, feedback, or result persistence

## Expected outcome

After this change, the analysis pipeline will use confidence-aware, metric-scoped smoothed keypoints before metric calculation, reducing phone-footage jitter while preserving the current pipeline architecture and user experience.
