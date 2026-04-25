# Calibration ppy Range — Investigation

## Headline

ppy = 200.42 is internally consistent and the edge-function `body_based` path (Patch 1 fix) drove it correctly. The reason the **resolved** value lands at ~200 instead of the predicted 80–150 is a **combination of two compounding factors**: the static reference is calibrated for closer filming distances, and the body-based anthropometric ratios over-predict pixel widths for athletes filmed at typical sideline distances when the auto-zoom factor is applied to a low-fill-ratio clip.

This is informational. Not blocking. Phase 1c calibration architecture input.

## Snapshot of resolved calibration (from `metric_results[*].detail.calibrationDetails`)

```
calibrationSource:                 body_based
pixelsPerYard:                     200.42
shoulderWidthPixels (avg):         120.12
hipWidthPixels (avg):              64.54
expectedShoulderWidthYards:        0.518   → implies athleteHeight = 0.518/0.259 = 2.000 yd = 72" = 6'0"
expectedHipWidthYards:             0.382   → implies athleteHeight = 0.382/0.191 = 2.000 yd, consistent
framesUsed:                        17
calibrationConfidence:             0.671
dynamicFailureReason:              dynamic_pixels_per_yard_out_of_range  (MediaPipe service rejected by 40–120 gate)
```

Internal math reconciliation:

```
shoulder estimate: 120.12 / 0.518 = 231.9 px/yd
hip estimate:      64.54  / 0.382 = 168.9 px/yd
unweighted avg:    (231.9 + 168.9) / 2 = 200.4    ✓ exact
```

The MediaPipe service computed its own `body_based` value (ppy = 277.785, shoulder_median_px = 147.86, hip_median_px = 68.57) using its **fixed** anthropometric constants (`SHOULDER_YARDS = 0.45`, `HIP_YARDS = 0.32`, `mediapipe-service/app/calibration.py` L17–18) and percentile (median) instead of mean. That value is persisted at the top level of `result_data.pixels_per_yard` but is **dead data** — rejected by `isDynamicCalibrationTrusted` at line 1303 (range gate `40 ≤ ppy ≤ 120`). The edge function's `body_based` calculation is what actually drove every metric.

## Why the resolved value lands at ~200, not 80–150

### 1. Static reference (80) is calibrated for the wrong distance.

`Sideline` ppy = 80 implies a person's shoulder width (~0.5 yd) appears as ~40 px. That corresponds to a person filmed from ~25–40 yards away on a fully zoomed-out tactical sideline cam. Today's clip was filmed substantially closer (or with a shorter focal length): the **measured** raw shoulder width was ~120 px (uncropped, original-coord-space), implying the camera was filling the frame much more than the static reference assumes. **The static reference is not "wrong" — it's calibrated for a different filming geometry than this admin test clip.**

### 2. Anthropometric ratios assume general-population proportions.

`calculateBodyBasedCalibration` (line 1597–1598):

```ts
const expectedHipWidthYards      = heightYards * 0.191
const expectedShoulderWidthYards = heightYards * 0.259
```

These ratios are sourced from general-adult proportions (DeLeva 1996 / Drillis & Contini 1966 lineage). For trained football athletes — especially WRs and linemen — bi-acromial breadth runs **5–12% wider** than population mean for a given stature. If the actual ratio for this athlete is 0.272 instead of 0.259, the shoulder estimate becomes `120.12 / (2.0 × 0.272) = 220.8 px/yd` — still high, but the systematic bias toward the ~200 region is at least partially explained by the ratios under-predicting expected width, which inflates ppy.

### 3. Pose model places shoulder/hip landmarks at joint-center, not body surface.

MediaPipe's L11/R12 (shoulders) and L23/R24 (hips) are anatomical joint centers, not the lateral edge of the body. The 0.259 / 0.191 ratios were originally derived from anthropometric measuring-tape definitions that follow the surface. For shoulder breadth specifically, joint-center spacing is 5–10% **narrower** than bi-acromial surface breadth, which means our **observed** pixel count is artificially small relative to the assumed yard width — pushing ppy **down**, not up. So this factor partially counteracts factor 2.

### 4. Hip vs shoulder disagree (231.9 vs 168.9) — variance is real.

The unweighted mean hides a 37% spread between shoulder-derived and hip-derived ppy. Hip width is harder to estimate accurately because hip joint centers are deeper inside soft tissue and visibility is more affected by clothing, jersey hang, and torso rotation. The shoulder estimate (231.9) is probably closer to truth in this clip; the hip estimate is likely under-detecting actual hip width. Averaging them weights a noisier signal equally with a cleaner one.

## Cross-check against the other metrics

If we accept ppy ≈ 200 is over-estimating actual yards-per-pixel by ~2×:
- Hip Stability reported 0.09 yd → true value ≈ 0.045 yd (matches elite target 0.05). ✓
- Hands Extension reported 1.74 yd → true value ≈ 0.87 yd (still well over the 0.4 elite target — Hands Extension has its own metric definition issues, separate investigation).
- Plant Leg Extension is angle-only, calibration-invariant, reported 103° unaffected. ✓

The pattern (every distance metric reading ~2× too high) is consistent with ppy being ~2× too high.

## Phase 1c architecture input (informational)

Three viable paths:

- **A. Tighten the dynamic acceptance gate range** (currently 40–120 px/yd). Either widen the gate to 40–300 to admit body-based estimates, or — better — split gates by `sourceLabel` so `body_based` outputs from the MediaPipe service have their own range (and the resolution machinery uses one source, not two competing implementations).
- **B. Deprecate edge-function body-based entirely** and rely on MediaPipe service body_based + static fallback. Removes the duplicate implementation and the dead-data confusion. Requires fixing the gate to admit MediaPipe service body_based output.
- **C. Replace anthropometric ratios with athlete-specific reference data**: when the athlete uploads their own height, also capture wingspan and shoulder width from a static reference photo, store on the athlete record, and use that instead of generic ratios.

## Recommendation

A is the smallest patch with the highest signal gain. C is the right long-term solution and aligns with Phase 1c's "calibration architecture decision" deliverable. B should only ship after we've collected ~10 admin tests to validate that MediaPipe's `body_based` is consistently within a tightened gate range.

Defer all of these. Document the finding, ship the velocity fix first.
