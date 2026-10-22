# Phase display + "Speed into the break" (Slant v11)

## Current state (checked)
- Slant WR is LIVE at version 10. Phases: Release, Stem, Break, Catch Window, YAC (After Catch).
- Active metrics: Plant Leg Extension (Break, weight 59), Hip Stability (Break, 18), Release Speed (Release, 23) = 100.
- Inactive: Head Snap Timing, Hands Extension at Catch, Post-Catch YAC Burst.
- So today Stem, Catch Window and YAC have no active metric. Result bcf95d35 has aggregate 93.

## 1. Results display
- Athlete-facing results: list only phases with at least one scored metric. The phase order and percentages stay as they are; phases are hidden, never removed from the node.
- Admin views (Testing Panel, run history, Analysis Log, Admin reference): keep every phase. Unscored phases show "Not measured" plus a reason:
  - "no active metric" — the phase has no active metric on the node.
  - "metric not measurable this run" — it has active metrics, but all of them were skipped (low confidence, missing frames, catch not found).
- One shared helper decides each phase's status, so every view agrees.

## 2. New Stem metric: Speed into the break
- Value: average hip-center speed (midpoint of keypoints 23 and 24) over the last 5 frames of the Stem window, divided by the peak 5-frame average hip speed anywhere in Stem. Unitless ratio, 0 to 1+.
- target_direction at_least, target 0.9, tolerance 0.2. Wording: "met the target" at 0.9 or above; "short of the target by 0.12" below.
- Description: "How much of your top stem speed you carry into the break."
- Same confidence rules as Release Speed (threshold 0.4, missing/rejected frames are never used). Skipped with a reason if Stem has fewer than 5 usable frames, or the peak speed is zero.
- Pixels-per-yard cancels in a ratio, so calibration can't change the value.

### Proposed weights (total 100)

```text
Metric                 Before  After
Plant Leg Extension      59     50
Release Speed            23     20
Hip Stability            18     15
Speed into the break      -     15
Total                   100    100
```
Reasoning: proportional trim of the three existing metrics, with the new metric equal to Hip Stability. Tell me if you want different numbers.

- Slant becomes version 11, still LIVE. Nothing else on the node changes: phases, percentages, other metrics, error rules, badges, prompts.
- Stem then shows as scored in athlete results; Catch Window and YAC stay hidden there.

## 3. Verification
- Rescore bcf95d35 from its stored keypoints and phase windows (no new pose run, nothing saved).
- Report: the Stem window frames used, the end speed, the peak speed, the ratio, its score, every metric's score under the new weights, and the aggregate before (93) and after.
- Show screenshots of an athlete-facing result and the Testing Panel with the "Not measured" reasons.

## Technical details
- New `calculation_type: "speed_retention"` in the analyzer, with the math as pure code in a separate module (unit-tested from `src/test`), reusing the smoothing and confidence helpers; record frames used, end and peak speeds in the metric detail and diagnostic export.
- Phase-status helper in `src/features/athlete-lab/utils/` returning `scored | no_active_metric | not_measurable`; athlete views filter, admin views render the reason.
- Node update via data change to Slant key_metrics + node_version 11.
- Tests: ratio math (end/peak, under-5-frames skip, zero-peak skip), at_least scoring at 0.9/0.7, weights total 100, phase-status reasons.
- Redeploy analyze-athlete-video; record the new module rule in AGENTS.md.
