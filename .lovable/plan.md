
Implement proper proportional phase windowing in `supabase/functions/analyze-athlete-video/index.ts` by replacing the current broad `buildPhaseWindows` behavior with a boundary-aware helper that allocates frames cleanly by phase weight, then adds overlap only at internal boundaries.

## What will change

### 1. Replace the current phase window helper
Update the existing phase segmentation logic so it uses a new helper with the requested contract:

- `calculatePhaseWindows(totalFrames, phases, frameBuffer)`

This helper will:
- accept the total analyzed frame count
- read the ordered `nodeConfig.phase_breakdown`
- allocate each phase a base non-overlapping frame span using `proportion_weight`
- apply overlap only at internal boundaries
- clamp all final windows to the inclusive range `[0, totalFrames - 1]`
- return inclusive `startFrame` / `endFrame` windows for each phase

### 2. Compute proportional base windows first
Build contiguous phase spans before applying overlap:

- sort phases by `sequence_order`
- normalize `proportion_weight`
- convert weights into frame counts that sum exactly to `totalFrames`
- assign contiguous base windows:
  - first phase starts at `0`
  - last phase ends at `totalFrames - 1`

Recommended approach:
- compute ideal frame counts from weights
- floor them
- distribute remaining frames by largest remainder so the final allocation is exact

This avoids drift caused by repeatedly rounding each phase independently.

### 3. Apply boundary overlap correctly
After the base windows are built, expand only around shared phase boundaries:

- for each boundary between phase A and phase B:
  - extend A’s end forward by `frameBuffer`
  - extend B’s start backward by `frameBuffer`
- do not add artificial padding before the first phase
- do not add artificial padding after the last phase
- clamp every final `startFrame` and `endFrame` to `0...totalFrames - 1`

Because `frame_buffer` exists per phase today, use a backward-compatible boundary rule:
- derive each boundary overlap from adjacent phases
- recommended: use the maximum of the left/right phase `frame_buffer`
- fallback to `3` when missing

This produces transition context for metrics like Break Angle, Head Snap Timing, Catch Window, and YAC Burst without over-expanding the outer edges.

### 4. Keep downstream metric usage unchanged
Integrate the new helper at the current phase-window step:

Current location:
- after temporal smoothing
- before metric calculations

Update the pipeline so it:
- calculates `phaseWindows` once after smoothing
- stores the result in the same analysis context/variable used today
- continues passing `phaseWindows` into `calculateAllMetrics`
- preserves the current downstream metric selection flow

No other pipeline behavior changes:
- progress messages remain the same
- cancellation checks remain the same
- result writing remains the same
- Claude / fallback behavior remains the same

### 5. Preserve compatibility with current log consumers
Keep the returned structure compatible with existing code that reads:

- `phaseWindows[phaseId].start`
- `phaseWindows[phaseId].end`

The helper can internally work with `startFrame` / `endFrame`, then map back to `{ start, end }` for the existing pipeline so no downstream refactor is needed.

### 6. Add explicit debugging logs for both stages
After phase windows are calculated, emit clear logs showing both:
- the base proportional windows before overlap
- the final overlapped windows after boundary expansion and clamping

Example summary:
- `Phase base windows calculated: Release (0-24), Stem (25-70), Break (71-92)`
- `Phase frame windows calculated: Release (0-30), Stem (24-74), Break (67-93)`

Include:
- phase name
- inclusive start/end
- frame buffer used at each boundary
- confirmation that final windows were clamped to valid frame bounds where needed

This should replace or augment the current `phase_windows_built` log with debugging output that makes proportional allocation and overlap behavior easy to verify.

## Files to update

- `supabase/functions/analyze-athlete-video/index.ts`

## Specific code areas to touch

### In the main pipeline flow
At the current Step 7:
- replace the `buildPhaseWindows(...)` call with `calculatePhaseWindows(...)`
- pass in:
  - `rtmlibResult.frame_count`
  - `nodeConfig.phase_breakdown`
  - a resolved frame buffer strategy

### In helper functions
Replace or refactor:
- `buildPhaseWindows`
- `buildPhaseWindowLog` only if needed to support the richer base-window and final-window logging

## Validation

1. Run a Slant node analysis
2. Confirm logs show readable base proportional windows
3. Confirm logs show final overlapped windows with boundary overlap applied
4. Confirm first phase starts at frame `0`
5. Confirm last phase ends at `totalFrames - 1`
6. Confirm all final windows are clamped to `[0, totalFrames - 1]`
7. Confirm adjacent phases overlap only around shared boundaries
8. Confirm metrics still calculate successfully using the new windows
9. Confirm no regressions in progress messages, cancellation, or final result writing

## Expected outcome

After this change, phase segmentation will be frame-accurate, proportionally allocated, overlapped only where transitions occur, and easier to debug because both the base and final window calculations will be visible in logs.
