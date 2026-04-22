
Apply the three fixes together in `supabase/functions/analyze-athlete-video/index.ts`, redeploy the function, then rerun the same Slant Route test and inspect logs/results to confirm unit-correct scoring and richer confidence diagnostics.

### Confirmed current state

- `calculateVelocity()` currently returns average pixels/second, not mph.
- `calculateAcceleration()` currently derives acceleration from those same unconverted velocity values, so it is also in pixel-based units.
- The live Slant Route node (`75ed4b18-8a22-440e-9a23-b86204956056`) is on `node_version = 2`.
- The node’s sideline calibration includes `pixels_per_yard = 80`, matching your expected fallback value.
- `scoreMetric()` is currently called with `mapping.tolerance`, while tolerance is stored on the metric object (`metric.tolerance`).
- `checkConfidence()` currently only returns a boolean and does not emit per-metric diagnostic detail.
- `fetchNodeConfig()` already loads `reference_calibrations`, and the pipeline already selects a calibration from the node based on camera angle.

### Change set

#### Fix 1 — convert velocity and acceleration to real units
Update the metric calculation flow so velocity and acceleration use calibration-aware units:

- Pass calibration context into `calculateVelocity()` and `calculateAcceleration()`.
- Compute mph as:

```ts
mph = (pixels_per_second * 2.045) / pixels_per_yard
```

- Use selected Cloud Run calibration first when `pixels_per_yard` is available.
- If Cloud Run calibration is null, fall back to the node’s selected camera-angle calibration from `reference_calibrations`.
- Include the calibration source in metric detail/logging:
  - `cloud_run_calibration`
  - `node_reference_fallback`
  - `missing_calibration`

For acceleration:
- convert the two velocity samples to mph first
- then compute acceleration in mph/s from those converted values

Expected result:
- Release Speed values are reported in mph, aligned with the metric target
- Post-Catch YAC Burst values are reported in mph/s, aligned with the metric target

#### Fix 2 — correct score tolerance source
In the scoring step, change the tolerance source from:

```ts
mapping.tolerance
```

to:

```ts
metric.tolerance
```

Also make the stored result and `metric_scored` log reflect `metric.tolerance`.

Expected result:
- metrics with valid `value` and `eliteTarget` now receive real non-null scores
- Release Speed and Head Snap Timing should no longer land with `score = null`

#### Fix 3 — add deeper confidence diagnostics
Refactor `checkConfidence()` so it calculates and logs a structured diagnostic payload for every metric, whether it passes or fails.

For each metric, log:
- `metric_name`
- `total_frames_in_window`
- `total_keypoint_checks`
- `passed_checks`
- `pass_ratio`
- `threshold` (the pass-ratio gate, currently 0.40)
- `confidence_threshold` (the per-keypoint minimum score used for a pass)
- `per_keypoint_avg_confidence`
- `lowest_confidence_keypoint`
- `frames_with_missing_keypoints`

Recommended event:
- `metric_confidence_evaluated`

Implementation detail:
- keep the boolean return behavior for pipeline control
- additionally return or expose the diagnostic object so it can be attached to:
  - pass logs
  - low-confidence flag logs
  - stored metric detail when useful

This will let the rerun clearly distinguish:
- strict confidence gating
- sparse / missing keypoints
- window quality problems
- downstream calculation failures

### Implementation approach

#### 1) Update metric calculation signatures
Adjust these functions so calibration is available where needed:
- `calculateVelocity(...)`
- `calculateAcceleration(...)`

Use a shared helper to resolve effective `pixels_per_yard`:
- prefer selected runtime calibration
- fallback to node reference calibration for the active camera angle
- return null when neither exists

#### 2) Centralize unit conversion
Add small helpers so conversion logic is consistent and testable:

```text
pixels/frame -> pixels/second -> mph
pixels/second² -> mph/s
```

Include conversion metadata in returned `detail` objects:
- `pixelsPerYard`
- `calibrationSource`
- `sampleCount`
- raw pixel-space value before conversion

#### 3) Refactor confidence gate
Upgrade `checkConfidence()` from a pure boolean helper into:
- diagnostic computation
- structured logging
- final boolean gate decision

Include per-keypoint averages keyed by index so the rerun makes weak keypoints obvious.

#### 4) Preserve existing pipeline behavior
Do not change:
- phase window logic
- metric inclusion/exclusion rules
- Claude request flow
- aggregate scoring threshold rules

Only change:
- unit correctness
- tolerance source
- confidence observability

### Deployment and verification plan

#### Step 1 — apply code changes
Edit only `supabase/functions/analyze-athlete-video/index.ts` for this coordinated fix set.

#### Step 2 — redeploy `analyze-athlete-video`
Redeploy the function so the updated scoring and diagnostic behavior is live.

#### Step 3 — rerun the same Slant Route pipeline
Use the same test flow as before:
- same live node
- same test video / upload-triggered path
- same 240-second operational wait budget

#### Step 4 — inspect logs
Pull the full logs for the rerun and verify:

Pipeline flow:
- `pipeline_started`
- `cloud_run_response_received`
- `phase_windows_built`
- `metric_window_selected`
- `metric_confidence_evaluated`
- `metric_scored` / `metric_failed` / `metric_flagged`
- `claude_response_received`
- `results_written`
- `pipeline_completed`

Specific checks:
- Release Speed logged in mph, not pixel units
- Post-Catch YAC Burst logged in mph/s, not pixel units
- scored metrics show real `tolerance` from the metric object
- failed/flagged metrics include enough confidence detail to identify weak keypoints or missing-frame problems

#### Step 5 — verify database output
Read the final `athlete_lab_results` row and confirm:
- `metric_results` contains real non-null scores for metrics that produced values
- `aggregate_score` is non-null if scored coverage meets the node threshold
- `phase_scores` is populated when aggregate scoring succeeds
- `feedback` contains real coaching text
- `node_version = 2`

### Expected outcome

After the coordinated fix:
- velocity and acceleration metrics use correct real-world units
- scored metrics no longer lose scores due to the tolerance source bug
- the rerun exposes exact confidence pass ratios and weakest keypoints per metric
- Release Speed and Head Snap Timing should show real scores instead of `null`
- aggregate and phase scoring should populate if the scored-metric threshold is satisfied
- the remaining non-scored metrics, if any, will be diagnosable from the new confidence logs rather than opaque `low_confidence` outcomes

### Technical notes

- No database migration is needed.
- No frontend code change is required for the 240-second wait unless you want that surfaced visually later.
- The sideline fallback calibration for the live Slant Route node is already present at `80 px/yard`, so the fallback path can be implemented without additional data changes.
