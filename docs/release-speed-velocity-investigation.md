# Release Speed Velocity Calculation — Investigation

## Headline

Calibration is innocent. The Release Speed velocity calculation is structurally fragile: **the metric was driven by a single frame-pair displacement** (`sampleCount: 1`), which trivially explodes any inter-frame jitter into an impossible mph value.

## Confirmed numbers (from persisted `metric_results[2]`, run `43931849-a10b-4a25-93cf-4b9b3ec10eb3`)

```
value:                       158.94 mph
elite_target:                7
fps:                         30
temporalWindow:              3
sampleCount:                 1     ← only ONE pixel displacement made it into the average
pixelsPerYard:               200.42 (body_based, edge function path — Patch 1 fix is in effect)
rawPixelsPerSecondAverage:   15576.7 px/sec
calibrationSource:           body_based
phase:                       Release (frames 0–15 of 85, ~0.53s at 30fps)
indices:                     [23, 24]  → midpoint of L/R hip
```

## Math reconciliation (proves no formula bug)

```
15576.7 px/sec ÷ 200.42 px/yd       = 77.72 yd/sec
77.72 yd/sec × 2.045 (3600/1760)    = 158.94 mph    ✓  matches reported value exactly
```

Implied per-frame hip-midpoint displacement: `15576.7 / 30 = 519 px`.
At ppy=200, that is `519 / 200 = 2.59 yards in 1/30s`, i.e. the hip jumped ~7.8 ft in 33ms.
Physically impossible. This is a **detection / sample-selection artifact**, not a math bug.

## Where the formula lives

`pixelsPerSecondToMph` (line 1726):

```ts
return (pixelsPerSecond * 2.045) / pixelsPerYard
```

Constant 2.045 = 3600/1760 (yd/sec → mph). Correct.

`calculateVelocity` (lines 2400–2495):

```ts
const window = frames.slice(0, Math.min(temporalWindow, frames.length))
for (let f = 1; f < window.length; f++) {
  ...
  const pixelDisp = Math.sqrt((cx-px)**2 + (cy-py)**2)
  const pixelsPerSecond = pixelDisp * fps
  ...
}
return { value: average(velocities), ... }
```

## Bug inventory (ranked by severity)

1. **HEADLINE — `temporal_window: 3` produces only 1–2 samples for averaging.**
   With 16 frames in the Release phase and a window of 3, the function looks at frames 0,1,2 only, giving 2 displacement deltas. Confidence-gating dropped one (final `sampleCount: 1`). One bad frame = the entire metric.

2. **Window starts at the beginning of the phase, not centered.**
   `frames.slice(0, temporalWindow)` ignores frames 3–15 of Release. The first frames of a phase boundary are exactly where pose-detection swaps and partial occlusion happen most. We measure velocity at the worst possible point in the phase.

3. **No outlier rejection.** A single 519-px jump (likely a mis-detection or person-index swap on a hip) is averaged in unweighted with the (possibly normal) other sample. There is no median, trimmed mean, or per-sample sanity gate (e.g. "reject sample if implied speed > 25 mph").

4. **Euclidean magnitude — no signed cancellation.**
   Back-and-forth jitter sums instead of cancels. For "release speed" we want **net displacement / elapsed time** across the phase, not the sum of frame-to-frame magnitudes. Sum-of-magnitudes systematically overestimates body velocity in the presence of any noise.

5. **No fps mismatch.** `fps: 30` in the detail; MediaPipe service resamples to `TARGET_FPS = 30` (`mediapipe-service/app/video.py` L14) before pose detection. Source `source_fps: 30` matches. fps is correct.

6. **No keypoint-space mismatch.** Keypoints are reverse-mapped from auto-zoom space back to original-image coordinates (`mediapipe-service/app/main.py` L151), and `ppy` is computed in the same original-image space. Zoom is consistent end-to-end.

## Plausible mph for this clip

For a WR off the line at the Release phase (~0.5s, 16 frames), realistic hip-center body velocity is **5–10 mph** (≈2–4.5 m/s). A 6–8 mph reading would have been credible; 158.94 mph is 20–30× over.

If we computed "net displacement / elapsed time" across the full 16-frame Release phase instead, with realistic hip travel of ~3–4 ft (~1.0–1.3 yd) in 0.53s, we would land near `2 yd/s × 2.045 = 4.1 mph` to `2.4 yd/s × 2.045 = 4.9 mph`. Still slightly low for "elite" (target 7), but in the right order of magnitude.

## Recommended fixes (for triage)

- **A. Use full-phase net displacement** instead of sum of frame-to-frame magnitudes. Compute `||midpoint(lastFrame) − midpoint(firstFrame)|| / ((N−1)/fps)` across the entire phase window.
- **B. If keeping per-frame samples**, raise default `temporal_window` to ≥ 9 (≈0.3s @ 30fps), use **median** instead of mean, and reject samples implying > 25 mph.
- **C. Move sampling window to the middle of the phase** (`frames.slice(midpoint - window/2, midpoint + window/2)`) instead of the first N frames.
- **D. Add per-sample `mph` array** to `detail` so the AnalysisLog can show per-frame velocity values for QA, not just the average.

A is the cleanest. B+C+D are incremental.

## Triage recommendation

Ship A as a small, surgical patch before the next test. It's a ~20-line change in `calculateVelocity`, reuses existing calibration plumbing, and converts Release Speed from "single-sample lottery" to "phase-net velocity" — the metric definition the elite target was originally derived from.
