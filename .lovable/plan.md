# Slant 4K30 run — diagnosis and proposed fixes

Reference run: result `6a7b892e…cab`, upload `b9ea9315…505c`, node Slant (WR) v6. All findings below are from that run's stored row and its function logs. Nothing has been changed. Out of scope throughout: Cloud Run, node status, metrics, weights, the 3-second window, and calibration logic.

File: `supabase/functions/analyze-athlete-video/index.ts` (the analyzer), unless another file is named.

---

## 1. Impossible values (436.58 mph, 1.95 yd)

**Root cause: Release Speed**
- `calculateVelocity` (L2496–2600) is meant to measure net displacement across the whole phase. But L2500 does `frames.slice(0, temporalWindow)`, so it only looks at the **first 3 frames** of the Release window (frames 0–12).
- Frame 0 has no detection, so the scan begins at frame 1. Stored detail: `firstFrameIndex 1`, `lastFrameIndex 2`, `elapsedFrames 1`, `netDisplacementPixels 561.9`. That is one jump between two frames, divided by 1/30 s, which gives 16,858 px/s ÷ 78.97 px/yd → 436.58 mph.
- `getMidpoint` (L2819) only drops points where `x <= 0`. It never checks confidence. Undetected frames with zeroed coordinates do get dropped, but a low-confidence point with a nonzero position (a hip that jumped 562 px) is used as-is.
- **"Temporal window: 0 frames":** the log builder (L1076) reads `keypoint_mapping.temporal_window`, which is not set on this metric, so it falls back to 0. The calculation uses its own fallback `|| 3` (L2311). The log and the actual calculation disagree; the calculation really used 3 frames.

**Root cause: Hands Extension (1.95 yd)**
- `calculateDistance` (L2447) reads a single middle frame (frame 15 of the Catch window). It measures the distance from keypoint 19 to keypoint 20 (left index finger to right index finger) and does not check confidence on that frame. A value of 154 px means the two hands were far apart on that one frame. One frame decides the whole metric.
- The same single-frame, no-confidence pattern exists in `calculateAngle` (L2419).

**Proposed fix**
- Velocity: use the whole phase window (first to last valid frame across all of it). Require at least N elapsed frames, defaulting to the temporal window, and skip the metric with `insufficient_valid_frames` if there aren't enough.
- `getMidpoint`, angle, and distance take the score arrays and reject any keypoint below the metric's confidence threshold, or with x≤0 or y≤0. Angle and distance use the median over the valid frames near the middle frame (±2) instead of a single frame.
- The log builder reports the temporal window that was actually used, not the raw mapping field.

**Verify:** rerun the library clip. Release Speed detail should show `elapsedFrames` ≥ 3 and a value in single digits or skipped, never 400+. Hands Extension detail should list the frames used.

---

## 2. Confidence gate let UNRELIABLE keypoints score

**Root cause**
- There are two separate confidence systems that never talk to each other:
  - The per-keypoint summary for the whole clip, `summarizeKeypointConfidence` (around L1048). This produces the RELIABLE, MARGINAL, and UNRELIABLE labels and the 17 warnings. It is display-only.
  - The gate for each metric, `checkConfidence` (L2828–2905). It passes a metric if **40% of keypoint checks** in its phase window clear the threshold (L2904, hardcoded `0.4`). Release Speed passed with 14/26 = 0.54. The others passed at 1.0 because their own phase windows were clean.
- So `confidence_handling = 'skip'` never fires, because no metric is ever marked `flagged`. The skip rule (L3138) only acts on metrics that are flagged.

**Proposed fix**
- The gate fails a metric if any of its effective keypoints is UNRELIABLE in the clip-level summary, or if the share of checks passing inside its window is below a configurable minimum (default 0.8, replacing the hardcoded 0.4).
- Failed metrics get `status: 'flagged'`, `reason: 'low_confidence'`. The existing skip, penalize, and flag-only handling then applies unchanged.

**Verify:** on the rerun, any metric that uses keypoint 19, 25, or 27 shows as flagged/skipped with `low_confidence`. If more than 50% are skipped, the aggregate shows as rejected instead of 8.

---

## 3. Sanity bounds

**Proposed fix:** add a plausibility table in the analyzer, keyed by unit and metric name, checked after calculation and before scoring:

```text
Release Speed / Top Speed (mph)   0 – 25
Hands Extension at Catch (yd)     0 – 1.2
Hip Stability (yd std-dev)        0 – 0.5
Plant Leg Extension / angles (°)  0 – 180
Sink Depth (yd)                   0 – 3
Head Turn Timing (sec)            0 – 3
Stride Consistency (yd)           0 – 1
```

A value outside its range becomes `status: 'skipped'`, `reason: 'implausible_value'`, and keeps the raw value in `detail.raw_value`. It is also written into `confidence_flags` (see item 5). It is never scored and never fed into error rules. The ranges are code constants, not node fields, so no node data changes.

**Verify:** a unit test feeds 436 mph and 1.95 yd through the check and expects them to be skipped. On the rerun, no out-of-range value has a score.

---

## 4. Error detection

**Root cause** (stored data: node errors use the key `error`, not `name`)
- `detectErrors` (L3215–3263) pushes `error.name` into its results. For every rule that is `undefined`. The one real trigger ("Rounding the break", 66.12 < 125, which is mathematically true) was stored as `detected_errors: [null]`.
- `buildErrorDetectionLog` (L1093–1113) marks a rule as triggered when `detected.includes(error.name)`. Since `detected` contains `undefined` and `error.name` is `undefined`, **every** rule shows as triggered: the 5 errors in the log, including the N/A ones and "Release Speed < 5" at 436.58. The analyzer did not actually trigger "Slowing down"; only the log claims it did.

**Proposed fix**
- Use one name resolver (`error.error ?? error.name`) in both functions.
- A rule triggers only if its metric exists, has `status: 'scored'`, has a finite value within the plausible range, and the condition is true.
- `triggered` in the log comes from that same per-rule evaluation, not a name lookup.
- Store `detected_errors` as `[{ name, condition, metric_value, severity }]`.

**Verify:** a unit test where the error uses the `error` key, plus N/A and implausible cases, expects only true conditions to trigger. On the rerun, `detected_errors` has no nulls and the log matches it.

---

## 5. Results display

**Root cause** (parser in `src/services/athleteLab.ts`, `parseMetricResults` L413–437; display in `TestingPanel.tsx` L1029–1060)
- Elite target "—": the stored `elite_target` is a number (140). The parser keeps it only if it's a string (L422).
- "Unassigned phase / Unknown calc": phase and calculation type are stored under `keypoint_mapping.phase_id` and `keypoint_mapping.calculation_type`. The parser reads top-level `phase_name` and `calculation_type`, which don't exist (L432–434).
- Unrounded score: the analyzer stores the raw score and the panel prints it without rounding.
- "No confidence flags": `confidence_flags` is empty because nothing was flagged (item 2). The 17 warnings come from the per-keypoint summary, which is a different field the panel never reads.
- Detected errors "null": caused by item 4's `[null]`.
- **Was the Video Library change the cause?** No. That change only added `result_data.calibration_audit` to the response from `admin-get-pipeline-result`. The field names above come from parser code that existed before it, and the stored row itself carries the defects (`[null]`, `[]`).

**Proposed fix:** the parser accepts a numeric `elite_target`, falls back to `keypoint_mapping.*` for phase and calculation type, and resolves the phase name from the node's phases. Scores are rounded to whole numbers for display only. The panel adds a "Keypoint warnings" list from `log_data.rtmlib.keypoint_confidence` (MARGINAL and UNRELIABLE entries). Confidence flags will include `implausible_value` and `low_confidence` once items 2 and 3 land.

**Verify:** after rerunning, open the result in the Testing Panel. It should show elite target 140, phase "Break", calc "angle", whole-number scores, real error names, and keypoint warnings that match the analysis log.

---

## 6. LLM feedback guard

**Root cause:** the only guard is `poseQualityAudit.usableData` (around L586/L832). That check passed here, so Claude received an 8/100 score and impossible numbers, and replied "STOP EVERYTHING — YOUR DATA IS BROKEN".

**Proposed fix**
- New rule: if any metric is skipped for `implausible_value` or `low_confidence`, or the aggregate is rejected, the analyzer does not send scores to the LLM. It stores a fixed, calm message instead, built from what failed:
  > "We couldn't track your movement clearly enough to score this rep. For the next clip: film from the sideline 10–15 yards away, keep your whole body in frame from snap to catch, use even lighting, and hold the camera still."
- Add one line naming the affected phase where relevant ("Your release wasn't visible clearly").
- `claude_api.status = 'SKIPPED'` with reason `low_quality_clip`.
- Clean runs are unchanged, and the node's prompt text is not edited.

**Verify:** the rerun's feedback is the calm message, the log shows Claude skipped, and no scores appear in the feedback.

---

## Technical notes

- All changes are inside the analyzer, `src/services/athleteLab.ts`, and `TestingPanel.tsx`. No schema, node, Cloud Run, or calibration changes.
- Pure helpers (plausibility check, error-rule evaluator, metric-result parser) get Vitest tests in `src/test/`, asserting the concrete limits above.
- Final check: rerun "Slant – Indoor Diagonal – 4K30" from the Video Library, then compare the new result row and log against this list item by item.
