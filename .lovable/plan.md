
Wire a single per-analysis calibration resolver into `supabase/functions/analyze-athlete-video/index.ts` so distance-based metrics use the best available source in this order: dynamic field-line detection, body-based fallback, static node fallback, then none.

### What will be built

1. Add a new unified calibration resolver
   - Create `resolveCalibration(...)` near the existing calibration helpers
   - Input:
     - Cloud Run calibration fields
     - keypoints and scores
     - optional `athleteHeight` from `upload.analysis_context`
     - node config
     - active camera angle
   - Output:
     - `pixelsPerYard`
     - `source: "dynamic" | "body_based" | "static" | "none"`
     - numeric `confidence`
     - structured `details`

2. Replace the old two-source resolver path
   - Retire usage of `resolvePixelsPerYard(...)`
   - Preserve existing static calibration lookup via `reference_calibrations`
   - Add support for the new middle tier using the already-built `calculateBodyBasedCalibration(...)`

3. Resolve calibration once in the main pipeline
   - After Cloud Run returns and once the active camera angle / analysis context are known, call `resolveCalibration(...)` one time
   - Pass the resolved calibration object into `calculateAllMetrics(...)`
   - Do not resolve calibration separately per metric

4. Update calibration-dependent metric calculators
   - Change `calculateDistance(...)`, `calculateVelocity(...)`, and `calculateAcceleration(...)` to accept the resolved calibration object instead of only a raw `pixelsPerYard`
   - Apply node `reference_fallback_behavior` rules when calibration source is `"none"`:
     - `disable_distance` → metric becomes skipped with reason `no_calibration_available`
     - `pixel_warning` → return raw pixel-based value with a warning flag for backward compatibility

5. Add calibration metadata to metric results
   - Ensure every distance/velocity/acceleration result includes:
     - `calibrationSource`
     - `calibrationConfidence`
     - `calibrationDetails`
   - Include this metadata in scored, failed, skipped, and warning-bearing outcomes so debugging remains consistent

6. Add structured calibration logs
   - `calibration_resolved`
     - source
     - confidence
     - pixelsPerYard
     - reason chosen
   - `calibration_source_fallback`
     - which higher-priority source was attempted
     - why it was rejected
     - which lower-priority source was selected next

### Files to update

- `supabase/functions/analyze-athlete-video/index.ts`

### Implementation details

#### 1) Expand runtime calibration types
Update internal types so the edge function can represent:
- Cloud Run calibration input:
  - `pixelsPerYard` or `pixels_per_yard`
  - `calibrationConfidence`
- Resolved calibration output:
  - `pixelsPerYard`
  - `source`
  - `confidence`
  - `details`

Also expand the typed Cloud Run response to include the dynamic calibration fields already returned by the service, without changing the service itself.

#### 2) Include missing node config needed for fallback behavior
`fetchNodeConfig(...)` currently selects `reference_calibrations` but not `reference_fallback_behavior`.

Update the select list so the resolver and metric layer can honor:
- `pixel_warning`
- `disable_distance`

#### 3) Resolve dynamic → body-based → static → none
Inside `resolveCalibration(...)`:

- **Dynamic**
  - Use Cloud Run only if:
    - `pixelsPerYard` is a valid positive number
    - `calibrationConfidence === "dynamic"`
  - Return:
    - `source: "dynamic"`
    - `confidence: 1` or a mapped high-confidence numeric value
    - `details` containing the raw Cloud Run calibration payload

- **Body-based**
  - Only attempt if athlete height exists
  - Call existing `calculateBodyBasedCalibration(...)`
  - Accept only when returned confidence is `>= 0.3`
  - Return:
    - `source: "body_based"`
    - helper confidence
    - helper details and method

- **Static**
  - Match `nodeConfig.reference_calibrations` by `cameraAngle`
  - Use a valid positive `pixels_per_yard`
  - Return:
    - `source: "static"`
    - a conservative numeric confidence
    - details with matched camera angle and static calibration record

- **None**
  - If nothing resolves:
    - `pixelsPerYard: null`
    - `source: "none"`
    - `confidence: 0`
    - `details` describing why dynamic/body/static were unavailable

#### 4) Keep body-based helper unchanged while using the correct tracked athlete
The existing body-based helper samples person index `0`.

To avoid modifying that helper while still respecting the locked target athlete, normalize the selected tracked person into a single-person frame set before calling `calculateBodyBasedCalibration(...)`. That lets the current helper stay unchanged while measuring the intended athlete rather than whichever person happened to be first in the frame.

#### 5) Update metric calculation flow
Refactor `calculateAllMetrics(...)` to receive:
- `resolvedCalibration`
- node `reference_fallback_behavior`

Then pass the full calibration object into:
- `calculateDistance(...)`
- `calculateVelocity(...)`
- `calculateAcceleration(...)`

These functions should:
- use `resolvedCalibration.pixelsPerYard` when available
- append calibration metadata to `detail`
- return structured outcomes for missing calibration according to fallback behavior

#### 6) Support skipped vs warning outcomes cleanly
The current metric pipeline treats `value === null` as failed. That is not sufficient for the new rules.

Refine the metric-result contract so calibration-dependent calculators can intentionally return:
- skipped + `no_calibration_available`
- scored/flagged with warning metadata for raw-pixel fallback
- failed only for true calculation errors

This lets `disable_distance` produce a real skipped metric instead of being misclassified as failed.

#### 7) Preserve backward compatibility for pixel warning mode
When `reference_fallback_behavior === "pixel_warning"` and no calibration resolves:
- distance/velocity/acceleration should still emit a numeric value derived from raw pixels
- mark the result clearly in `detail`, for example:
  - `warning: "uncalibrated_pixel_value"`
  - `calibrationSource: "none"`
  - `calibrationConfidence: 0`

This keeps the current unsafe fallback available while making it explicit in result metadata and logs.

### Validation after implementation

Verify these scenarios in the deployed function:

1. Dynamic calibration present and marked `"dynamic"`
   - resolver selects dynamic
   - logs `calibration_resolved` with source `dynamic`

2. Dynamic missing, athlete height present, body-based confidence `>= 0.3`
   - resolver selects body-based
   - metric details include body-based calibration metadata

3. Dynamic missing, no athlete height, static camera-angle calibration available
   - resolver selects static
   - behavior matches previous static fallback path

4. No dynamic, no valid body-based result, no static match
   - resolver returns `source: "none"`
   - `disable_distance` metrics are skipped with `no_calibration_available`
   - `pixel_warning` metrics return raw pixel-based values with warning metadata

5. Metric result payloads
   - every calibration-using metric includes:
     - `calibrationSource`
     - `calibrationConfidence`
     - `calibrationDetails`

6. Structured logs
   - fallback transitions emit `calibration_source_fallback`
   - final chosen source emits `calibration_resolved`

### Technical notes

- No database changes are required
- No UI changes are required
- No Cloud Run changes are required
- The existing `calculateBodyBasedCalibration(...)` helper remains untouched
- Metric targets and Claude prompts remain unchanged
