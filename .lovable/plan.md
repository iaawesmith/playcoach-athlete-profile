Implement detection-frequency tuning as a small, backward-compatible update centered on `supabase/functions/analyze-athlete-video/index.ts`, while aligning the AthleteLab admin defaults and reference copy with the new behavior.

## What will change

### 1. Refine detection-frequency selection in the edge function
Update the existing detection-frequency selector so it resolves one run-level `det_frequency` before the Cloud Run call using this priority:

1. Scenario-specific override from node config
   - support the existing flat fields already in use:
     - `det_frequency_solo`
     - `det_frequency_defender`
     - `det_frequency_multiple`
2. Support an optional nested config shape if present on the node:
   - `detection_frequency.solo`
   - `detection_frequency.with_defender`
   - `detection_frequency.multiple`
3. Fallback behavior
   - if `analysis_context.people_in_video` is missing or indicates solo/unknown, default to `2`
   - with defender defaults to `1`
   - multiple defaults to `1`

This preserves current pipeline structure while making solo the safe default for the primary use case.

### 2. Support a Break-phase override without changing the Cloud Run contract
Because the Cloud Run request accepts a single `det_frequency` for the whole run, implement the Break-phase behavior as a run-level clamp:

- inspect `nodeConfig.phase_breakdown`
- if the Break phase carries an optional override such as `det_frequency` or `detection_frequency`
- lower the selected run-level frequency to that value when it is smaller than the scenario-selected value
- do not attempt per-phase switching mid-run

This keeps the implementation minimal and compatible with the current single-request analysis flow.

### 3. Add explicit logging for detection choice
Add a clear log entry right after analysis context selection and before the Cloud Run call, for example:

- `Detection frequency set to 2 for this run (solo)`
- `Detection frequency set to 1 for this run (with_defender)`
- `Detection frequency set to 1 for this run (multiple)`

Include structured log details such as:
- upload ID
- detected scenario
- base scenario value
- whether a Break override lowered it
- final value passed to Cloud Run

### 4. Keep Cloud Run integration unchanged except for the resolved value
Continue passing a single `det_frequency` into `callCloudRun(...)` exactly as today, but make sure the resolved tuned value is what gets sent.

No changes to:
- progress messages
- cancellation checks
- temporal smoothing
- phase windowing
- metric calculations
- Claude / fallback behavior
- results persistence

## Admin / node configuration alignment

### 5. Respect and normalize the existing AthleteLab detection fields
The admin already uses:
- `det_frequency_solo`
- `det_frequency_defender`
- `det_frequency_multiple`

Keep those fields as the primary editable controls and ensure their effective defaults are:

- solo: `2`
- with defender: `1`
- multiple: `1`

### 6. Update stale fallback/reference copy in the admin
The training-status UI currently still references the old generic fallback of `7`. Update the admin display/reference copy so it matches the new tuning logic:

- solo default/effective fallback should read as `2`
- with defender and multiple remain `1`
- any generated “pipeline reference” snippets and fallback helper text should no longer imply that `7` is the default operating value for solo runs

### 7. Keep saved-node behavior safe for older records
For older nodes where these fields may be null or unset:

- continue using null-safe defaults in the UI
- ensure the edge function also defaults safely at runtime
- if needed, normalize outgoing saves from the node editor so blank values persist as `2/1/1` instead of remaining undefined

This avoids requiring a broad schema refactor while still making behavior deterministic.

## Files to update

- `supabase/functions/analyze-athlete-video/index.ts`
- `src/features/athlete-lab/components/NodeEditor.tsx`
- `src/features/athlete-lab/utils/nodeExport.ts`
- optionally `src/features/athlete-lab/types.ts` only if a typed optional Break override field is added to phase config

## Technical details

### Edge-function logic
Implement a helper pattern like:

- `normalizePeopleInVideo(context.people_in_video)` → `solo | with_defender | multiple`
- `resolveDetectionFrequency(nodeConfig, peopleInVideo, phaseBreakdown)` → final number

Resolution rules:
- read existing flat fields first
- support nested `detection_frequency` object if present
- clamp to integer `>= 1`
- apply Break-phase override as `final = Math.min(baseScenarioFrequency, breakOverride)` when valid

### Break override shape
To stay backward-compatible, the edge function can read optional fields directly from raw phase objects without requiring every node to have them, for example:
- `phase.det_frequency`
- `phase.detection_frequency`

If later desired, that can be exposed in the admin UI, but it does not need to be required for this tuning pass.

## Validation

1. Run a Slant node analysis with solo context
2. Confirm logs show:
   - `Detection frequency set to 2 for this run (solo)`
3. Confirm the Cloud Run request receives `det_frequency: 2`
4. Confirm pose output still returns valid keypoints
5. Compare stability on fast-transition metrics such as:
   - Break Angle
   - Head Snap Timing
6. Confirm no regressions in:
   - progress updates
   - cancellation
   - temporal smoothing
   - phase windowing
   - final results writing
7. Verify AthleteLab admin now displays `2 / 1 / 1` as the effective defaults and no longer suggests `7` as the solo fallback

## Expected outcome

After this change, solo athletic movements will use a much more appropriate detection cadence by default, the node editor’s configuration will match the real pipeline behavior, and fast transition moments like the slant break will have a better chance of receiving fresh detections without changing the rest of the analysis pipeline.