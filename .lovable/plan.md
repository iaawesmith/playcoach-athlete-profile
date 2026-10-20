# Calibration, frame-0 detection and per-frame scale — diagnosis and proposed fixes

Scope: Slant WR, library clip "Slant – Indoor Diagonal – 4K30" (4K, 30 fps, 68 frames, diagonal tripod, athlete 69 in). Nothing is built until approved. No node data, weights, status or 3-second window changes. Pose service changes are delivered as a diff for you to deploy.

## 1. Calibration disagreement

**(a) Why the analyzer discards the service's 110.17.** The analyzer only trusts a service value labeled as line-based ("dynamic"/"trusted", 8+ yard-line pairs). The pose service has no line detection: it always labels its value `body_based` with confidence high/medium/low. So 110.17 is rejected on its label, even though it falls within the 40–120 range. The analyzer then runs its own body-width estimate. Two width estimates use different body assumptions:
- Service: shoulders 0.45 yd, hips 0.32 yd (fixed adult averages), visibility at least 0.7.
- Analyzer: shoulders 0.259 × height, hips 0.191 × height (0.496 / 0.366 yd at 69 in), every 5th frame.
- 48.98 px / 0.496 = 98.7 and 21.70 px / 0.366 = 59.3, weighted to 78.97.

**(b) Do width estimates read too low side-on?** Yes, for structural reasons. Shoulder and hip width are measured across the body, so they shrink with the cosine of the body's rotation away from the camera. On a diagonal run the athlete is mostly side-on, and the hips collapse the most: 21.7 px against an expected ~80 px at 220 px/yd, about 27%. Neither width method can be corrected for rotation without depth. They should not be used as the scale source for side or diagonal clips.

**(c) Would a height-based estimate be more reliable?** Yes. Body height (head to ankle) is much less sensitive to rotation around the vertical axis, which is what a diagonal run produces. The method:
- Pixel height per frame = vertical extent from nose/eyes to the lower of the heels or foot tips (landmarks 0, 1–6, 27–32).
- Add a fixed head-top allowance (nose to crown is about 0.06 × height).
- Keep only "upright" frames: torso within about 20° of vertical and knee angles above about 150°.
- Use a high percentile (p80) of those values divided by 69 in (1.917 yd).
- Running crouch still shortens apparent height, so non-upright frames get a posture correction from hip/knee angles (see item 4) or are excluded from the single-value estimate.

On this clip, a ~390 px crouched height gives ≈ 200–225 px/yd, which matches your manual estimate.

**(d) Where 80.00 comes from.** It is a hand-entered value in the Slant node's sideline PRIMARY setting (`reference_calibrations`: sideline 80 px/yd; end zone and behind-QB are not supported). It was carried into every cloned node, with no derivation or source recorded. It assumes a 1080p perpendicular sideline camera framing 8–15 yards. It is **not valid** for this clip: it was set for 1080p, not 4K, and the camera is diagonal and close. It should stay a last resort, and be flagged when the clip resolution differs from what it assumes.

**Proposed fix (analyzer only):**
- Add a `height_based` candidate as described above.
- Selection order: dynamic (real line pairs) → height_based → width body_based → static.
- Record the service value under its true label (`service_body_width`), not as a rejected "dynamic" value.
- Accept height_based only when there are at least 8 upright frames and the spread (p90/p10) of the per-frame values is within 1.35 across frames used.

## 2. Frame 0 and the other 5 missed frames

Root causes in `mediapipe-service/app` (strongest first):
1. **Tracking state contaminated by auto-zoom probes.** `auto_zoom.decide_and_apply` calls `engine.detect()` on 12 spread-out sample frames, then again on zoomed frames. It uses the same shared VIDEO-mode landmarker with auto-incremented timestamps. The tracker leaves those probes holding the region of interest from the last probe frame (late in the clip, possibly in zoomed coordinates). `run_with_skip` then starts at frame 0 with that stale region. Tracking fails, and the landmarker returns nothing until its detector re-fires. This is F-POSE-1 (shared singleton, `get_engine()`), still unfixed in the code.
2. **Forward-fill with `det_frequency=2`.** Odd frames copy the previous result. One missed even frame becomes two empty frames, which explains some of the 6.
3. **Small person on a 4K frame.** The person detector runs on a ~224 px downscale. A ~390 px athlete in a 2160 px frame is about 18% of the height. That is fine once tracking works, but borderline for a cold detect at a 0.5 threshold when he is crouched.

Proposed diff (for you to deploy):
- New `PoseEngine` per request, created in `analyze` and closed in `try/finally`. Remove the singleton use.
- Auto-zoom probes use a separate IMAGE-mode landmarker, closed after the probe, so no tracking state leaks into the main pass.
- Run the main pass with `det_frequency=1` for calibration runs (or always for clips ≤ 120 frames), with timestamps starting at 0 for each request.
- If frame 0 still returns nothing, re-run frames 0–2 through the IMAGE-mode landmarker (`min_pose_detection_confidence` 0.3), and mark those frames `recovered: true` in the response.
- Return `frames_detected` and the list of missed frame indices in the response.

## 3. Calibration logging

Extend the existing `calibration_audit` to always record:

```text
candidates: [
  { source: "dynamic",            ppy|null, status, reason },
  { source: "service_body_width", ppy: 110.17, shoulder_px, hip_px, assumptions },
  { source: "height_based",       ppy, frames_used, upright_frames, p10/p50/p90, spread },
  { source: "body_width",         ppy: 78.97, shoulder_px, hip_px },
  { source: "static",             ppy: 80, camera_angle, resolution_assumed }
]
selected: { source, ppy, rule: "first acceptable in priority order", rejected_reasons_by_source }
per_frame_scale: { enabled, min, max, smoothing_window } (if item 4 is approved)
```

This will show in the Testing Panel results under a "Calibration" block (candidate table, winner highlighted).

## 4. Per-frame scale — evaluation and recommendation

| Approach | Start (≈225) | Catch (≈170) | Effect on this clip |
|---|---|---|---|
| Single ppy (78.97 today) | 65% under | 54% under | All distances and speeds inflated 2–3×; Hands 1.83 yd |
| Single height-based (≈200) | -11% | +18% | Inside the 20% target at both ends, but only just near the catch |
| Per-frame height-based, smoothed | ~0% | ~0% | Follows the 25–30% shrink; the catch-window Hands metric uses ≈170 |

Per-frame method:
- Pixel height per frame from landmarks, divided by a posture factor: estimated standing-height ratio from hip and knee flexion, clamped to 0.80–1.0.
- Divide by 1.917 yd and smooth with a centered median of 5 frames, then a moving average of 5 frames.
- Fill missed frames by interpolation. Clamp frame-to-frame change to 3%.
- Distance metrics use the scale at their own frames. Speed metrics convert each step's displacement with the average scale of its two frames.

**Recommendation: per-frame height-based scale**, with the single height-based value as fallback when there are fewer than 60% valid frames. A single value can't pass the "within 20%" criterion at both ends of a run that changes size by 25–30%. On a perpendicular sideline clip the per-frame scale is close to constant, so it costs nothing there. Expected Hands Extension: 1.83 yd × 78.97 / ~170 ≈ 0.85 yd, or ≈ 0.66 yd at 220. Either way it is within 0–1.2 yd.

## 5. Determinism

Today, shared tracking state and auto-incremented timestamps make results depend on earlier requests. The per-request landmarker (item 2), timestamps starting at 0, and the separate probe landmarker remove that. The analyzer side is already pure once given the same keypoints.

## How we verify on this clip (after you deploy the service diff)

1. Unit tests in `src/test`:
   - Height-based estimator, posture factor, smoothing and candidate selection, using synthetic keypoints: a 390 px upright athlete at 69 in gives 203 px/yd ±1, and a shrinking series follows the expected values.
   - The audit records every candidate, the winner and the reasons.
   - "Rounding the break" fires only when Plant Leg Extension < 125.
2. Rerun "Slant – Indoor Diagonal – 4K30" twice from the Video Library and check the pass criteria:
   - Frame 0 detected, with the missed-frame count reported.
   - Selected source is `height_based` (per-frame); scale is 200–235 at the start and 160–190 at the catch.
   - Hands Extension is scored within 0–1.2 yd; at least 3 of 4 metrics are scored; no implausible values.
   - "Rounding the break" fires only if Plant Leg Extension < 125°.
   - Both runs give identical metric values, scores, errors and calibration audit (only IDs and timestamps differ).
3. Check that the Calibration block renders in the Testing Panel.

Risk: Release Speed was flagged at a 0.538 window pass ratio. Fixing frame 0 and forward-fill should raise it, but we can't be sure it reaches 0.8. If it doesn't, 3 of 4 still passes, provided Hands is scored.

## Technical details

- Analyzer: new pure helpers in `supabase/functions/analyze-athlete-video/calibration.ts` (height estimate, posture factor, smoothing, candidate selection), unit-tested from `src/test`. `index.ts`:
  - `resolveCalibration` builds the candidates.
  - Metric calculators take a `scaleAt(frame)` function instead of a single number.
  - The audit is extended.
- Pose service diff: `app/pose.py` (factory instead of singleton, `close()`), `app/auto_zoom.py` (IMAGE-mode probe engine), `app/main.py` (per-request engine in try/finally, `det_frequency=1` for short clips, frame-0 recovery, missed-frame list), `app/schema.py` (new response fields).
- UI: Calibration block in `TestingPanel.tsx`, parsed through `pipelineResults.ts`.
- No schema, node, weight, status or window changes.
