
Build the live auto-zoom wiring in the real `playcoach-rtmlib-service` repo by making only thin `main.py` integration changes and leaving the helper math in `preprocessing.py` and `calibration.py` intact.

1. Inspect the real service’s existing internals in `main.py`
- Identify the current live frame loader used to fetch/decode the clip into frames + FPS.
- Identify the current rtmlib person detector already used in the service.
- Identify the current pose runner already used in the service.
- Note their exact function names, imports, and return shapes so the new wiring can adapt to them with minimal glue code.

2. Replace the placeholder `/analyze` endpoint with a thin adapter
- Remove the `RuntimeError` body in `analyze(request: AnalyzeRequest)`.
- Reuse the current `analyze_clip_with_existing_backends(...)` orchestration path.
- Inside `analyze()`, wire the existing live frame loader, detector, and pose runner into that function.
- If the live internals use slightly different signatures or output shapes, add only tiny local adapter wrappers in `main.py` to normalize:
  - detector output into `{ bbox|box|xyxy, confidence|score, label|class }`
  - pose output into `keypoints: list[list[list[float]]]` and `scores: list[list[float]]`

3. Keep the auto-zoom flow exactly in the existing helper path
- Use `run_autozoom_pipeline()` before pose inference.
- Run pose inference on the zoomed frames returned by that helper.
- Use `remap_results_to_original_space()` on the pose result.
- Run `compute_confidence_weighted_body_calibration()` on the processed results.
- Call `log_auto_zoom()` and `enrich_response_metadata()` exactly once in the main orchestration path.
- Keep the endpoint body thin; do not duplicate logging, cropping, or metadata logic inside `analyze()`.

4. Preserve backward compatibility
- Keep returning the existing response fields:
  - `keypoints`
  - `scores`
  - `frame_count`
  - `fps`
  - `progress_updates`
- Also return the additive metadata already modeled on `AnalyzeResponse`:
  - `auto_zoom_applied`
  - `auto_zoom_reason`
  - `auto_zoom_factor`
  - `auto_zoom_original_fill_ratio`
  - `auto_zoom_final_fill_ratio`
  - `auto_zoom_crop_rect`
  - `auto_zoom_padding`
  - `movement_direction`
  - `movement_confidence`
  - `person_detection_confidence`
  - `safety_backoff_applied`
  - `coordinate_transform`
  - `athlete_framing_message`
  - `calibration_source`
  - `calibration_details`
  - `pixels_per_yard`

5. Keep fallback behavior explicit and safe
- If `auto_zoom_enabled` is false, pass original frames through unchanged.
- If no reliable person is detected, keep the identity transform and original frames.
- If the crop decision falls back, still return valid keypoints/scores plus the skip reason and framing message.
- Do not change smoothing, phase logic, scoring logic, UI progress behavior, or cancellation behavior.

6. Run the requested smoke test in the real service repo
Use one known distant clip and exercise the live `/analyze` endpoint end-to-end.

Smoke test steps:
- Run a baseline pass on original frames with the existing pose runner to compute mean keypoint confidence.
- Run the full `/analyze` endpoint with `auto_zoom_enabled: true`.
- Compare baseline mean keypoint confidence vs zoomed-frame mean keypoint confidence.
- Confirm returned keypoints are remapped to original-space coordinates.
- Confirm calibration metadata is populated.

7. Report the required results after build
Provide:
- Auto-zoom decision details
  - whether auto-zoom triggered
  - skip reason if not
  - zoom factor
  - original fill ratio
  - final fill ratio
- Confidence improvement delta
  - baseline mean keypoint confidence
  - zoomed mean keypoint confidence
  - delta
- Key logs
  - person detection confidence
  - auto-zoom applied/skipped
  - movement direction
  - padding applied
  - safety backoff applied
  - calibration source and pixels/yard
- Compact JSON metadata sample
  - `auto_zoom_applied`
  - `auto_zoom_reason`
  - `auto_zoom_factor`
  - `auto_zoom_final_fill_ratio`
  - `movement_direction`
  - `safety_backoff_applied`
  - `coordinate_transform`
  - `athlete_framing_message`
  - `calibration_source`
  - `calibration_details`
  - `pixels_per_yard`

Technical note
- The current visible `playcoach-rtmlib-service` snapshot only contains the scaffolded auto-zoom files and not the real live loader/detector/pose implementation, so the actual build must be applied in the real external service repository/folder where those existing internals live.
- Expected code changes should stay almost entirely in `playcoach-rtmlib-service/main.py`, with helper files unchanged unless a tiny compatibility fix is required.
