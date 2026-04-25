# Calibration Source Trace — Empirical

Run traced: `athlete_lab_results.id = d1b3ab23-6289-4c07-b914-eb8474e5ca24`
File: `supabase/functions/analyze-athlete-video/index.ts`

## 1. Priority order in `resolveCalibration` (lines 1428–1547)

1. **Dynamic** — `cloudRunCalibration` (the rtmlib/MediaPipe service response object) is fed into `isDynamicCalibrationTrusted`. Accepted only if ALL of:
   - `pixels_per_yard` present and within `40 ≤ ppy ≤ 120` (line 1303)
   - `good_line_pairs ≥ 8` (or null/absent → passes this gate by default, line 1304)
   - `calibration_flag !== 'unreliable'` (line 1305)
   - `calibration_source === 'dynamic'` OR `calibration_confidence ∈ {'dynamic','trusted'}` (lines 1301–1302, 1363)
2. **Edge body-based** — only runs if `athleteHeight` is set; calls `calculateBodyBasedCalibration` (line 1484). Accepted if `confidence ≥ 0.3`.
3. **Static reference** — `selectCalibration(nodeConfig, cameraAngle)` (line 1518); `confidence: 0.45`.
4. **None** — `pixelsPerYard: null` returned (line 1545).

## 2. Branch taken for d1b3ab23

Persisted `result_data.log_data.rtmlib`:
```
calibration_source:     "body_based"
calibration_confidence: "high"
pixels_per_yard:        299.641
calibration_details:    { method: "body_based", shoulder_median_px: 164.6,
                          hip_median_px: 69.43, frames_used: 81, ... }
```

Walking the gates against those values:

| Gate | Required | d1b3ab23 actual | Result |
|---|---|---|---|
| `pixelsPerYard` present | yes | 299.641 | pass |
| `40 ≤ ppy ≤ 120` | yes | 299.641 | **FAIL** |
| `good_line_pairs ≥ 8` or null | yes | null | pass |
| `calibration_flag !== 'unreliable'` | yes | null | pass |
| `source === 'dynamic'` OR `confidence ∈ {dynamic,trusted}` | yes | source=`body_based`, confidence=`high` | **FAIL** |

→ Dynamic branch **rejected** with `reason = 'dynamic_pixels_per_yard_out_of_range'` (line 1324; the range gate fires before the source-label gate).

Then fallback (line 1477): `if (athleteHeight)` — Slant node test had height set → **edge `calculateBodyBasedCalibration` ran** → produced `pixelsPerYard ≈ 167.87` from the buggy COCO-17 indices (eye/ear separation ≈ 43px treated as shoulder width).

So the persisted `rtmlib` block records the MediaPipe service's internal calibration (299.641, never adopted), while the actual calibration consumed downstream came from the edge function (167.87).

**Answer to (a/b/c)**: It's (c) — two parallel paths exist. The MediaPipe service computes its own `body_based` calibration and returns it on every call; the edge function rejects it (range gate) and computes its own via `calculateBodyBasedCalibration`. Only the edge function's value drives metric calculations.

## 3. Where pixelsPerYard is consumed

Metric calculation reads `calibration.pixelsPerYard` directly. Quoted sites:

```
2370:   if (!calibration.pixelsPerYard || calibration.pixelsPerYard <= 0) {
2394:     value: pixelDist / calibration.pixelsPerYard,
2436:     const mph = pixelsPerSecondToMph(pixelsPerSecond, calibration.pixelsPerYard)
2667:   if (!calibration.pixelsPerYard || calibration.pixelsPerYard <= 0) {
2685:   const yardStdDev = pixelStdDev / calibration.pixelsPerYard
```

`calibration` here is the **`ResolvedCalibration` returned by `resolveCalibration`** (line 709). Not `rtmlibResult`, not `cloudRunCalibration`. The MediaPipe service's ppy=299.641 never reaches these lines unless the dynamic branch accepts it — which it didn't for d1b3ab23.

## 4. Hip Stability empirical reconciliation

Original measured: 0.10 yd (Hip Stability std dev).

| Hypothesis | ratio | corrected value |
|---|---|---|
| Edge function ppy (167.87) drove metric, true ppy ≈ 80 (static reference) | 167.87 / 80 = 2.10 | 0.10 / 2.10 = **0.048 yd** |
| MediaPipe service ppy (299.641) drove metric | 299.641 / 80 = 3.75 | 0.10 / 3.75 = 0.027 yd |

**0.048 yd matches elite Hip Stability target (≈ 0.05 yd) almost exactly.** Confirms the edge function's `calculateBodyBasedCalibration` produced the calibration that drove metric calculations on d1b3ab23.

## Conclusions

- **Patch 1 fixed the right code path.** The buggy `calculateBodyBasedCalibration` was the active calibration source for the failed test, and the metric pipeline reads only its output (via `ResolvedCalibration`).
- **The MediaPipe service's internal `body_based` calibration is dead data downstream.** It's logged in `log_data.rtmlib` but rejected by every gate in `isDynamicCalibrationTrusted` (range and source-label). It never affects scoring.
- **Implication for the next test**: Patch 1's index swap should pull the edge function ppy from ~167.87 down toward the correct shoulder/hip pixel widths. With the corrected indices reading actual shoulder landmarks (~80px wide for an athlete ~12 yd from camera, athlete height 6'2" → expected shoulder ≈ 0.533 yd), expect ppy ≈ 80–150 — squarely inside the `40 ≤ ppy ≤ 120` window OR just above it. If new ppy lands in 80–120, the resolved calibration source will be `body_based` (still fallback path; the dynamic source-label gate still rejects it) and Hip Stability should fall to ~0.05 yd.
- **Phase 1c open question reframed**: The MediaPipe service ppy=299.641 is NOT contaminating metrics today. It's a parallel diagnostic that's never read. The Phase 1c calibration architecture decision is now narrower: do we (i) wire MediaPipe service ppy in by relabeling its `calibration_source` to `dynamic` and tightening its quality, (ii) leave it as parallel diagnostic and trust edge `body_based`, or (iii) drop edge `body_based` entirely and rely only on static reference + future dynamic line-pair detection.

## Adjacent finding

The `40–120 ppy` range gate at line 1303 silently rejects any MediaPipe-service calibration where ppy > 120. For d1b3ab23 (ppy=299.641) that's clearly correct. But it means: **even if MediaPipe service produced a perfectly accurate ppy of, say, 100, it would still be rejected by the source-label gate** (`source === 'dynamic'` required, but service emits `body_based`). The two gates compound — line-pair-based dynamic calibration is the only path that can ever be accepted as "dynamic". Worth flagging for the Phase 1c architecture decision.
