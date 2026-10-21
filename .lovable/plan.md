# Run 44c52897 — diagnosis and proposed fixes

Reference: Slant – Indoor Diagonal – 4K30 (3840x2160, 90 frames, route_direction "right").

## Diagnosis (from the stored row and code)

**Fill ratio 0.** `_bbox_fill` divides the athlete box *area* by the full 4K frame area (8.3M px). A ~240 px tall, ~50 px wide athlete is ~12k px², about 0.0013 — formatted to 2 decimals that prints "0.00". The value is correct, but area against a 4K frame is the wrong gate: it zooms almost every wide sideline clip.

**Crop loses the athlete.** The crop is centered on the *median hip of 4 sampled frames*, sized to frame/1.75 (2194 px wide, x 735–2929). The athlete crosses from hip x ≈1008 to ≈2910 — the full path is ~1900 px plus body width, so it fits only if centred on the path, not the median. By frame 74 the hip sits 19 px from the crop edge; from 75 on the body leaves the crop. Frame 75 is a tracker hallucination at the edge (hip 1951,836, height 421 px); frames 76–89 return nothing. Nothing checks for the athlete leaving the crop.

**Missed frames reported as detected.** In the export, frames 77–89 show `detected: true` with hip x = 0. The service zero-fills undetected frames to keep the shape the same, and the export's `detected` test only checks that the array is non-empty.

**Plant leg (item 4) — inverted.** The `route_direction` branch picks the *same* side as the break: right → right leg (24, 26, 28). Coaching says plant on the outside foot, which is the leg *opposite* the break direction. So the mapping is inverted for plant-leg metrics. It's correct as written for metrics that follow the break side, so the fix has to be per metric, not global.

**Release window (item 5).** Proportional segmentation starts Release at frame 0. Hip x barely moves through frame 10 (1008→1015), then rises steadily, so the first ~11 frames are stance, not release.

**Hands Extension (item 6).** It's measured at the middle of the Catch Window, not when the ball arrives. In this run the late frames (76–89) are missing, so any catch-anchored measurement would have nothing to use.

**keypoint_warning (item 7) — partly not reproduced.** The stored `confidence_flags` *does* contain a warning for Hands Extension on keypoint 19. Clip-level UNRELIABLE keypoints are 13, 15, 17, 19, 21, 22. The empty flags are in the export path. The export doesn't read the `confidence_flags` column, and the result-fetch function may not return it. This needs confirming first.

**Phase windows and keypoint confidence (item 9).** Both are stored under `log_data.rtmlib`, so the export is missing them because of a read-path gap, not a capture gap.

## Stage 1 — pose service (deployed separately)

1. **Zoom gate.** Skip zoom when the median athlete height across the probe frames is at least 150 px (setting `AUTOZOOM_MIN_HEIGHT_PX`). Keep fill ratio as a secondary signal, measured by height share rather than area. Log the reason with 4 decimals.
2. **Path-covering crop.** Probe 8 frames spread across the clip. Build the union box of every confident detection plus 15% margin (at least one body height). Then size the crop to cover that box, keeping the aspect ratio and capping zoom at 1.75x. If the box can't fit at 1.1x or more, skip zoom.
3. **Exit fallback.** Per frame, if the detected box touches the crop edge (within 2% of it) or detection is lost while zoomed, re-run that frame on the full frame and record it in `zoom_fallback_frame_indices`.
4. **Partial detections.** Mark a frame not detected (zeroed, and listed in `missed_frame_indices`) when it fails any of these checks: under 60% of the 33 landmarks visible, box clipped by the crop or frame edge, or hip jump or height change beyond plausible limits from the last good frame (catches frame 75).
5. **Timings and build.** Add `timings_ms` (decode, probe, pose, total) and `service_build` (`K_REVISION` plus a `SERVICE_BUILD` env var or git SHA) to the response. These are additive fields.

## Stage 2 — analyzer

4. **Plant leg.** Add a per-metric rule: when an angle metric's name or phase marks it as a plant leg (Break or Sink phase, lower-body hip-knee-ankle triplet), the route-direction branch picks the *opposite* side. Other metrics keep the current rule. Record `plant_side_rule: "outside_foot"` in `bilateralDecision`. This changes the analyzer only — node mappings are untouched.
5. **Movement-anchored Release.** Find the first frame where hip-centre speed stays above a threshold (about 0.15 yd per frame by scale, or 1% of frame width) for 3 or more frames in a row. Release starts there, and the rest of the window is split proportionally as today. The 3-second clip window is unchanged, and the anchor frame is recorded.
6. **Catch-anchored Hands.** Estimate ball-arrival frames as where the wrists converge and peak in the last phase. Measure over ±2 frames around that point. If those frames are missing or below confidence, mark the metric skipped with reason `catch_frames_unavailable`. It won't fall back to mid-window.
7. **keypoint_warning.** Confirm the export reads `confidence_flags`. Make the result fetch return it, and include it in the export's `errors` and `metrics` sections.
8. **Unmeasured phases.** Phases whose metrics are all skipped or flagged report `"not measured"` instead of a score in `phase_scores`. They're left out of the LLM prompt's metric and phase blocks, and their names are listed as not measured.
9. **Export.** `detected` uses the service's `missed_frame_indices` and the all-zero check. Read phase windows and keypoint confidence from `log_data.rtmlib`, and show timings and service build when they're present.

## Verification

- Unit tests (pure helpers): zoom gate at 149 and 151 px, path crop contains all hips plus margin, edge-exit fallback, partial-detection rejection (frame 75 case), right break uses the left plant leg and left break uses the right, release anchor = frame 11 on this run's hip series, catch frames missing gives skipped, unmeasured phase left out of the prompt.
- Deploy Stage 1 and rerun the clip twice: there should be no missed frames 76–89, timings and build should appear, and the two runs should match.
- Then deploy Stage 2 and rerun. Compare each item against 44c52897 using the diagnostic export.

## Not changed

Node data, weights, status, the 3-second window, scoring formula, calibration math.

## Technical notes

- Files: `mediapipe-service/app/auto_zoom.py`, `pose.py`, `main.py`, `schema.py`. Analyzer: `analyze-athlete-video/index.ts` (bilateral selection, phase segmentation, hands measurement, phase scores, prompt builder), and new pure helpers in `quality.ts` / `segmentation.ts`. Plus `admin-get-pipeline-result`, `diagnosticExport.ts`, and tests in `src/test`.
- Stage 2 works with the old service response: when the new fields are absent, it uses the current behaviour.
