
Implement the Auto-Zoom + Smart Cropping feature entirely inside the external `playcoach-rtmlib-service`, centered on `main.py`, with the following refinements added before build.

## Scope

Primary target:
- `playcoach-rtmlib-service/main.py`

Optional helper extraction only if that repo already uses helpers:
- `playcoach-rtmlib-service/preprocessing.py`
- `playcoach-rtmlib-service/calibration.py`

No app repo, Edge Function, or AthleteLab UI changes in this phase unless the external service already requires a typed response model update on its own side.

## What to build

### 1. Add a dedicated preprocessing stage before final pose extraction
Inside the `/analyze` flow in `main.py`:

1. load the clip as today
2. sample multiple early/mid frames
3. run existing person detection / bbox logic
4. identify the primary athlete track
5. build a multi-frame motion envelope
6. decide whether auto-zoom should run
7. crop + upscale frames using the selected crop window
8. run pose inference on the zoomed frames
9. transform all returned coordinates back into original-frame coordinates
10. run improved body-based calibration using the zoomed detections
11. return backward-compatible JSON with added metadata

### 2. Use a multi-frame union bounding box for stable crop decisions
Do not base crop on a single frame.

Add logic that:
- collects the chosen athlete bbox across sampled frames
- builds a union bbox covering the athlete’s motion envelope
- rejects unstable detections if the union grows erratically from poor tracking
- uses the union bbox as the base crop subject before target-fill resizing and padding

This should make crop decisions stable for route-running footage, shaky phones, and slight athlete drift.

### 3. Add intelligent motion-direction detection and directional padding
Add a helper such as:
- `estimate_motion_direction(...)`
- `compute_directional_padding(...)`

Rules:
- estimate horizontal and vertical movement from the sampled athlete bbox centers over time
- classify dominant travel direction with a confidence score
- add extra padding in the direction of travel, especially forward for routes
- if direction confidence is weak, revert to symmetric padding

Padding rules:
- minimum 15% padding on all sides
- additional forward padding scaled by motion strength
- preserve aspect ratio
- clamp to frame bounds

### 4. Add hard safety rules so cropping never cuts off hands/feet during full motion
Before finalizing the crop:
- expand beyond the union bbox with limb safety margins
- preserve a full-motion envelope for likely arm swing, leg extension, release, break, catch, and follow-through
- if the computed crop risks clipping extremities or future movement, back off zoom until safe
- prefer conservative framing over aggressive zoom

Add explicit guardrails:
- no crop that places the athlete too close to any edge after safety padding
- if the athlete is already well-framed (>=55% fill), apply minimal or zero zoom
- if safe target fill cannot be reached without risk, use the safest feasible crop and log the reduction

### 5. Build a structured auto-zoom decision object
Add an internal object/dict such as:

- `enabled`
- `reason`
- `target_person_confidence`
- `original_person_fill_ratio`
- `target_fill_ratio`
- `final_fill_ratio`
- `zoom_factor`
- `crop_rect_original`
- `padding_applied`
- `movement_direction`
- `movement_confidence`
- `safety_backoff_applied`
- `transform`
- `athlete_message`

This object should drive logs and the response metadata.

### 6. Crop and upscale with OpenCV
In `main.py`:
- crop frames to the chosen rectangle
- resize back to original resolution using `cv2.INTER_CUBIC` or equivalent high-quality interpolation
- preserve frame timing / FPS
- preserve audio if the current service outputs a processed clip; otherwise preserve alignment metadata so analysis timing remains correct

### 7. Make coordinate transformation robust, with clear no-zoom fallback
Add helpers such as:
- `build_coordinate_transform(...)`
- `map_keypoints_to_original_space(...)`
- `map_bbox_to_original_space(...)`

Rules:
- when zoom is applied, inverse-map all pose points and boxes from zoomed frame space back to original coordinates
- when no zoom is applied, use an identity transform explicitly
- if any transform inputs are invalid, fall back safely to identity/original-frame behavior and log the reason
- keep downstream outputs behaving as if inference happened on the original video

Apply to:
- keypoints
- bounding boxes
- calibration geometry where needed before exposing final values

### 8. Improve body-based calibration on zoomed detections
Update or add:
- `compute_confidence_weighted_body_calibration(...)`
- refined `multi_frame_body_proportions_hips_shoulders(...)`

Rules:
- run calibration on the zoomed detections for improved landmark separation
- weight frame contributions by keypoint confidence
- reject unstable or low-confidence outlier frames
- report final `pixels_per_yard` and method clearly
- preserve backward-compatible calibration fields already consumed downstream

### 9. Expand the response contract with backward-compatible metadata
Keep existing keys untouched and add optional fields such as:
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
- enriched `calibration_details`
- `calibration_source`
- `pixels_per_yard`

### 10. Make the athlete-facing message natural and encouraging
Prepare the returned message so it sounds supportive, not technical. Example tone:

- “Your video was a little far away, so I zoomed in and adjusted the framing to get a clearer read on your movement. For even better results next time, try filming from about 10–15 yards away with your full body in frame.”

If no zoom is applied because the framing is already good:
- “Your framing looked strong, so analysis used the original video as-is.”

If zoom is skipped due to unclear detection:
- “I analyzed the original video without reframing because the athlete could not be isolated confidently enough for a safe crop.”

### 11. Add structured logging for debugging and trust
Required logs:
- `Person detection confidence: X.XX`
- `Auto-Zoom applied: X.XXx (athlete filled Y% → Z% of frame)`
- `Padding applied: top=Xpx, bottom=Ypx, left=Zpx, right=Wpx`
- `Movement direction: right (confidence 0.81)`
- `Safety backoff applied: true — reduced crop to preserve extremities`
- `Coordinate transform: scale_x=..., scale_y=..., offset_x=..., offset_y=...`
- `Final calibration source: body_based — XX.XX px/yard`

If zoom is skipped:
- log a clear reason such as `auto_zoom_skipped_no_reliable_person`, `auto_zoom_skipped_already_well_framed`, or `auto_zoom_skipped_invalid_transform`

## Exact files and functions to modify

### Required
`playcoach-rtmlib-service/main.py`

Modify or add these logical sections/functions:
- `/analyze` endpoint flow
- multi-frame person detection sampling
- target-athlete selection
- multi-frame union bbox builder
- motion-direction estimator
- crop computation with directional padding and safety backoff
- crop/upscale executor
- coordinate transform builder + inverse mapper
- confidence-weighted body calibration helper
- response serializer for new metadata
- structured logging calls

### Optional helper extraction if the repo already supports it
`playcoach-rtmlib-service/preprocessing.py`
- `select_main_athlete_track`
- `build_union_motion_bbox`
- `estimate_motion_direction`
- `compute_auto_zoom_crop`
- `apply_crop_and_resize`
- `build_coordinate_transform`
- `map_points_to_original_space`

`playcoach-rtmlib-service/calibration.py`
- `compute_confidence_weighted_body_calibration`
- refined `multi_frame_body_proportions_hips_shoulders`

## Execution order

1. inspect current `/analyze` flow in `main.py`
2. add multi-frame detection sampling
3. add primary-athlete selection
4. build multi-frame union bbox and motion-direction estimate
5. compute crop with minimum padding, forward bias, and hard safety rules
6. crop + upscale frames
7. run pose on zoomed frames
8. inverse-transform outputs back to original coordinates with identity fallback when no zoom is applied
9. run improved confidence-weighted body calibration
10. append response metadata and athlete-facing message
11. add structured logs
12. run an internal distant-clip validation

## Validation to run after implementation

Use one known distant clip and verify:

### A. Auto-zoom decision quality
- multi-frame union bbox is stable
- motion direction is detected sensibly
- forward padding appears in the direction of travel
- athlete fill ratio improves toward the 62–72% target when safe

### B. Safety behavior
- no clipped hands or feet across release, break, catch, or stride extension
- conservative backoff triggers when a tighter crop would be unsafe
- already-close footage gets minimal or zero zoom

### C. Pose quality improvement
Compare before vs after on the same distant clip:
- mean keypoint confidence
- stability of wrists, elbows, knees, ankles, and hands if wholebody is enabled
- reduced jitter / improved metric stability

### D. Coordinate correctness
Confirm that:
- mapped keypoints align in original-frame space
- distances, angles, and velocities remain plausible
- calibration values still make sense downstream
- no-zoom runs return identity transform cleanly

### E. Fallback safety
Test:
- no person / weak person confidence
- off-center athlete
- partial occlusion
- extremely wide shot
- already well-framed video

Expected result:
- the service never crashes
- it falls back to original-frame analysis when needed
- logs and metadata explain exactly why

## Expected outcome

After this build, the Cloud Run service will intelligently rescue distant or imperfect phone footage using a stable multi-frame union crop, motion-aware directional padding, and strict extremity-protection rules. It will improve pose quality without distorting metrics by mapping all outputs back to original video coordinates, and it will return clear, athlete-friendly metadata explaining what framing assistance was applied.
