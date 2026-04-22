Implement a standalone body-based calibration helper inside `supabase/functions/analyze-athlete-video/index.ts`, without wiring it into the current fallback path yet.

### What will be built

1. Add a new helper:
   - `calculateBodyBasedCalibration(keypoints, scores, athleteHeight)`
   - Returns:
     - `pixelsPerYard: number | null`
     - `confidence: number`
     - `source: "body_based"`
     - `method: string`
     - `details` with averaged hip/shoulder widths, frames used, and expected body widths in yards

2. Keep the helper fully isolated
   - Do not modify `resolvePixelsPerYard`
   - Do not change metric calculation flow
   - Do not change admin UI or tests
   - Do not alter existing calibration fallback behavior

### Implementation approach

#### 1) Add body-calibration result types near existing calibration helpers
In `supabase/functions/analyze-athlete-video/index.ts`, define small internal types for:
- athlete height input (`value`, `unit`)
- body calibration result
- sampled frame measurement records if needed

This keeps the helper strongly typed and consistent with the existing edge-function style.

#### 2) Add unit conversion helpers
Create a small helper to normalize athlete height into yards:
- inches → yards using `/ 36`
- cm → yards using `/ 91.44`

This ensures the final calibration logic always works in one internal unit system.

#### 3) Sample frames and collect body-width measurements
Inside `calculateBodyBasedCalibration(...)`:
- sample every 5th frame
- use the primary tracked person at index `0` within the provided frame arrays
- on each sampled frame:
  - read shoulder keypoints `5` and `6`
  - read hip keypoints `11` and `12`
  - read matching confidence scores for those same keypoints
- only include a body-width measurement when both keypoints in that pair exist and are valid

Per valid frame, calculate:
- shoulder width in pixels
- hip width in pixels
- pair confidence averages

#### 4) Convert expected body proportions into yard-based reference widths
Using normalized height in yards:
- `expectedShoulderWidthYards = heightYards * 0.259`
- `expectedHipWidthYards = heightYards * 0.191`

For each valid sampled frame, derive:
- `shoulderPixelsPerYard = shoulderWidthPixels / expectedShoulderWidthYards`
- `hipPixelsPerYard = hipWidthPixels / expectedHipWidthYards`

Then average the available per-frame estimates into a final `pixelsPerYard`.

#### 5) Add confidence scoring
Build a bounded `0..1` confidence score that starts at `1.0` and subtracts for:
- weak keypoint confidence on shoulders/hips
- high cross-frame variance in the per-frame pixels-per-yard estimates
- unreasonable final pixels-per-yard values outside the expected `40–150` range

Planned structure:
- compute average pair confidence across used frames
- compute standard deviation on the frame-level estimates
- apply additive penalties
- clamp at `0`

If the final confidence is `< 0.3`, return:
- `pixelsPerYard: null`
- confidence still populated
- full debug details still returned

#### 6) Return structured debug metadata
The helper will return:
- `hipWidthPixels` as average across used frames
- `shoulderWidthPixels` as average across used frames
- `framesUsed`
- `expectedHipWidthYards`
- `expectedShoulderWidthYards`

Also include a descriptive `method` string such as:
- `"multi_frame_body_proportions_hips_shoulders"`

### File to update

- `supabase/functions/analyze-athlete-video/index.ts`

### Placement in the file

Add the new helper near the existing calibration/math helpers:
- around `resolvePixelsPerYard`
- `pixelsPerSecondToMph`
- other metric utility functions

This keeps all calibration-related logic grouped together for the next prompt, when it gets wired into the runtime flow.

### Validation after implementation

Verify the helper:
1. Accepts the existing keypoint and score array shapes already used in the edge function
2. Correctly converts height from inches or cm into yards
3. Samples every 5 frames
4. Uses shoulders `5-6` and hips `11-12`
5. Returns averaged body widths and expected yard widths
6. Produces a confidence score between `0` and `1`
7. Returns `pixelsPerYard: null` when confidence is below `0.3`
8. Does not change any current metric, fallback, or scoring behavior

### Technical notes

- This should be implemented as a pure helper with no side effects
- It should gracefully handle missing frames, missing persons, missing keypoints, or bad scores by skipping unusable samples instead of throwing
- No pipeline integration should happen yet; the next prompt can decide where this helper fits in the calibration resolution order