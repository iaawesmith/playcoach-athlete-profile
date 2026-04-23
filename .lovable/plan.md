
Implement the calibration hardening work in two phases, with priority placed on improving the dynamic calibration stage inside the Cloud Run service first, then updating the edge-function fallback resolver to consume the richer calibration metadata without changing the rest of the pipeline.

## Implementation order

### 1. Focus first on dynamic calibration inside Cloud Run
Update the Cloud Run `/analyze` calibration step before touching fallback behavior in the edge function.

Priority changes in Cloud Run:
- retune `cv2.Canny` thresholds for noisy real phone footage
- retune `cv2.HoughLinesP` parameters, especially:
  - threshold
  - `minLineLength`
  - `maxLineGap`
- strengthen line filtering so only near-horizontal lines that span most of the frame width are kept
- de-duplicate fragmented detections so the same painted field line does not count multiple times
- require a minimum good line-pair count before trusting dynamic calibration:
  - target threshold: at least `8–10` good line pairs
- reject dynamic calibration when:
  - good line-pair count is below threshold, or
  - computed `pixels_per_yard` falls outside a reasonable range such as `40–120`

Add Cloud Run logging:
- `Dynamic calibration: found X line pairs, calculated Y.YY px/yard`

Add Cloud Run response fields:
- `calibration_source`
- `pixels_per_yard`
- `calibration_details`
- `good_line_pairs`
- rejection reason when dynamic calibration is not trusted

This makes Cloud Run the source of truth for whether dynamic calibration is truly usable.

### 2. Then update the edge-function fallback resolver
After Cloud Run returns richer calibration metadata, refine `resolveCalibration(...)` in `supabase/functions/analyze-athlete-video/index.ts` so it uses that metadata instead of accepting any dynamic-looking value blindly.

Fallback order in the edge function:
1. trusted dynamic calibration from Cloud Run
2. body-based calibration using athlete height plus body proportions
3. static node calibration from `reference_calibrations`
4. raw pixels only, with `calibration_flag: "unreliable"`

Edge-function acceptance rules for dynamic calibration:
- accept only when Cloud Run marks dynamic calibration as trusted, or returns enough metadata to prove:
  - good line-pair count is high enough
  - `pixels_per_yard` is within the valid range
- otherwise fall through to body-based, then static, then none

Add explicit final source logs in the edge function:
- `Calibration source: dynamic (15 line pairs, 82.4 px/yard)`
- `Calibration source: body-based (using athlete height)`
- `Calibration source: static (80 px/yard from node config)`
- `Calibration source: none (raw pixels)`

## Repo changes

### In this repo
Update:
- `supabase/functions/analyze-athlete-video/index.ts`

Optional typed/UI alignment if needed:
- `src/features/athlete-lab/types.ts`
- `src/features/athlete-lab/components/TestingPanel.tsx`
- `src/services/athleteLab.ts`

### Outside this repo
The primary tuning work must happen in the external Cloud Run service code, since that is where:
- `cv2.Canny`
- `cv2.HoughLinesP`
- dynamic line filtering
- line-pair counting
are actually implemented.

## Technical details

### Cloud Run
Implement a stricter dynamic-calibration pipeline:
- inspect several early usable frames
- preprocess frames for phone footage
- keep only long, near-horizontal line segments
- cluster/de-duplicate similar lines
- form candidate yard-line pairs
- compute `pixels_per_yard` from robust pair spacing statistics
- trust the result only if:
  - `good_line_pairs >= 8` (or final chosen threshold in the 8–10 range)
  - `40 <= pixels_per_yard <= 120`

### Edge function
Expand parsing of Cloud Run calibration payload so it can read:
- `calibration_source`
- `calibration_details`
- `good_line_pairs`
- rejection reason
- `calibration_flag`

Preserve compatibility with older responses by continuing to read existing:
- `pixelsPerYard`
- `pixels_per_yard`
- `calibrationConfidence`
- `calibration_confidence`

## Validation

1. Test several real phone-footage clips, including wide backyard-style shots
2. Confirm dynamic calibration produces more realistic values, typically around `60–100 px/yard`
3. Confirm bad dynamic outputs are rejected before reaching distance/velocity metrics
4. Confirm fallback order works correctly:
   - dynamic
   - body-based
   - static
   - none
5. Confirm logs clearly show:
   - line-pair count
   - computed px/yard
   - final calibration source used
6. Confirm distance, velocity, and acceleration metrics are more stable when calibration succeeds
7. Confirm no regressions in:
   - progress messages
   - temporal smoothing
   - phase windowing
   - metric calculations
   - cancellation
   - result persistence

## Expected outcome

After this update, the work starts where it matters most: the dynamic calibration step itself becomes much stricter and more reliable on real phone footage, and the edge-function fallback resolver then uses that richer calibration metadata to choose the best safe fallback without affecting the rest of the pipeline.
