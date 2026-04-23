
Run a focused three-video validation suite for the live Slant node using the exact URLs you provide, without making any non-critical changes.

## Validation scope

### 1. Use the Testing Panel with matched analysis context per clip
For each supplied video URL, run the Slant node from `/athlete-lab` using the existing Testing Panel and capture:
- upload ID / result ID
- stage and progress messages shown in the UI
- total elapsed analysis time
- final result payload, confidence flags, Pose Quality Audit, and raw analysis log

Planned run setup:
- **Left-break slant**: `route_direction = left`, good-quality sideline/perpendicular, solo, catch as appropriate
- **Right-break slant**: `route_direction = right`, same quality conditions
- **Marginal backyard clip**: real wide / lower-confidence setup with body dimensions included if useful for calibration fallback testing

### 2. Validate bilateral auto-detect behavior on the left-break clip
Confirm from logs and result behavior that:
- bilateral selection resolves correctly for left-side metrics
- the log includes the confidence comparison and chosen side
- Break Angle, Separation Distance, and Hands Extension return reasonable non-zero values when pose quality supports them
- detection frequency and temporal smoothing logs are present and sensible

Artifacts to capture:
- bilateral decision source and side
- left vs right average confidence
- key metric scores
- detection frequency used
- smoothing / phase-window logs
- calibration source and `pixels_per_yard`

### 3. Validate bilateral symmetry on the right-break clip
Confirm that the same node works symmetrically for the mirrored direction:
- bilateral selection resolves to right
- key bilateral metrics still calculate with comparable structure
- no regression from the left-break case in scoring flow, smoothing, or phase windowing

Artifacts to capture:
- bilateral decision log
- right-side confidence advantage
- Break Angle, Separation Distance, Hands Extension, and Release Speed results
- calibration source and `pixels_per_yard`
- progress messages and runtime

### 4. Validate low-confidence handling on the marginal backyard clip
Confirm the degraded-footage path behaves correctly:
- Pose Quality Audit panel appears in the UI
- low-confidence metrics are flagged/skipped gracefully rather than producing misleading values
- the Claude feedback call is skipped when pose quality is too low
- the result still surfaces actionable diagnostics instead of failing silently

Artifacts to capture:
- Pose Quality Audit contents
- count of flagged/skipped metrics
- explicit Claude skipped status / reason from logs
- calibration source used and whether it fell back to body-based, static, or none
- progress messages, runtime, and any warnings/errors

## Reporting format

For each of the three runs, report:
- video label
- upload ID / result ID
- bilateral auto-detect choice and confidence comparison
- calibration source and `pixels_per_yard`
- key metric scores:
  - Break Angle
  - Release Speed
  - Hands Extension
  - Separation Distance when present
- progress messages shown in UI
- overall analysis time
- any errors, warnings, or unexpected behavior

Then provide a final summary with:
- what is working solidly now
- any remaining tuning needs, especially around:
  - confidence thresholds
  - calibration robustness
  - smoothing behavior
  - metric symmetry between left and right clips

## Critical bug handling
If a blocking bug prevents meaningful validation:
- isolate it to the smallest possible scope
- patch only that critical blocker
- rerun the affected validation case(s)
- clearly separate “bug fixed during validation” from the rest of the report

## What I need from you
Send the three direct video URLs for:
1. left-break slant clip
2. right-break slant clip
3. marginal / backyard-style clip

Once those URLs are provided, the validation can be run exactly against those files and reported in the structure above.
