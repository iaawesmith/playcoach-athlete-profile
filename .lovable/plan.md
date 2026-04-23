
Implement bilateral auto-detect as a small, isolated update centered on `supabase/functions/analyze-athlete-video/index.ts`, with a minimal AthleteLab editor enhancement so one Slant node can support both left-break and right-break clips without duplicating node definitions.

## What will change

### 1. Add side-selection priority logic in the edge function
Refine the current bilateral resolver so side selection follows this order for each metric:

1. `bilateral_override` if set to `force_left` or `force_right`
2. `analysis_context.route_direction` if provided as `left` or `right`
3. confidence-based auto-detect when neither of the above applies

This replaces the current simple `resolveBilateral(mapping, routeDirection)` behavior with a richer resolver that can return both:
- the chosen side
- the reason/source of that choice (`override`, `route_direction`, `confidence_auto`, or fixed bilateral setting)

### 2. Add confidence-based bilateral auto-detect after smoothing/person lock
Introduce a helper such as `chooseBestBilateralSide(metric, keypoints, scores, personIndex)` that runs after temporal smoothing and target-person locking, using the already-sliced phase frames for that metric.

Behavior:
- derive the left-side keypoint indices for the metric
- derive the right-side mirror indices for the metric
- compute average confidence across the left set
- compute average confidence across the right set
- return the side with the higher average confidence

This helper should work only when the metric is effectively bilateral and eligible for auto-selection.

### 3. Resolve mirrored left/right index sets from the keypoint library
The existing metric config stores a single `keypoint_indices` array plus bilateral settings. To support auto-detect without introducing duplicate nodes, add a small helper that uses `src/constants/keypointLibrary.json` side metadata to build:

- `leftIndices`
- `rightIndices`

Approach:
- treat `Left ...` / `Right ...` keypoints and `side` metadata as mirror pairs
- preserve center keypoints unchanged on both sides
- if the configured metric is authored on one side, generate the mirrored opposite-side indices automatically
- if a keypoint has no mirror pair, keep it unchanged so center/head landmarks still work

This keeps the data model minimal and avoids requiring node authors to duplicate every metric mapping.

### 4. Apply the chosen indices consistently through confidence checks and calculations
Once the effective side is resolved for a metric, use that selected index set everywhere for that metric’s evaluation in the current run:

- `metric_window_selected` logging
- `checkConfidence(...)`
- `calculateAngle(...)`
- `calculateDistance(...)`
- `calculateVelocity(...)`
- `calculateAcceleration(...)`
- `calculateFrameDelta(...)`

Do not change:
- phase windowing
- temporal smoothing behavior
- cancellation flow
- scoring formulas
- results writing
- progress messages

Only the effective indices passed into the existing metric pipeline should change.

### 5. Add explicit bilateral logs
Add a dedicated log entry when confidence-based auto-detect is used, with wording equivalent to:

- `Bilateral auto-detect chose left side for Break Angle (conf left: 0.84, right: 0.61)`

Also include structured details in the existing JSON logging style:
- metric name / id
- chosen side
- left average confidence
- right average confidence
- left indices
- right indices
- effective indices actually used
- selection source

If side came from override or route direction, log that source clearly as well so run behavior is easy to audit.

### 6. Respect existing bilateral settings without widening scope
Preserve current semantics:
- `bilateral_override` remains highest priority
- `route_direction` remains second priority
- `bilateral: left` or `bilateral: right` should behave as fixed-side metrics
- `bilateral: auto` is the recommended/default path for route metrics

This ensures backward compatibility for existing nodes that already depend on forced-side behavior.

## AthleteLab admin UI updates

### 7. Keep bilateral visible and defaulted to auto in the Metrics tab
The editor already defaults new mappings to:
- `bilateral: "auto"`
- `bilateral_override: "auto"`

Keep that default and make the bilateral section more transparent rather than changing the model.

### 8. Show left/right derived indices in the metric editor
Update `src/features/athlete-lab/components/KeyMetricsEditor.tsx` so the mapping panel displays:

- configured/base indices
- derived left indices
- derived right indices

This should be a transparency aid only:
- no new complicated editor flow
- no duplicate manual entry fields required unless absolutely necessary
- authors can keep selecting one side as the base mapping and immediately see the mirrored alternative that auto-detect may use

A concise presentation in the selected-summary area is enough:
- Base
- Left
- Right
- keypoint names where helpful

### 9. Keep node normalization compatible
If needed, make only minimal normalization updates in `NodeEditor.tsx` or shared types so older metrics still safely default to:
- `bilateral: "auto"`
- `bilateral_override: "auto"`

No larger schema change is required unless exploration during implementation shows the editor cannot derive mirrored indices cleanly from the existing library.

## Files to update

Primary:
- `supabase/functions/analyze-athlete-video/index.ts`
- `src/features/athlete-lab/components/KeyMetricsEditor.tsx`

Possibly minor support updates:
- `src/features/athlete-lab/components/NodeEditor.tsx`
- `src/features/athlete-lab/types.ts`

## Technical details

### Edge-function design
Add small helpers near existing metric/confidence logic:
- mirror-index resolver from keypoint library metadata
- left/right confidence averaging helper
- richer bilateral side resolver returning chosen side + source + effective indices

Suggested flow per metric:
1. get phase window
2. build `phaseFrames` / `phaseScores`
3. resolve effective side and indices
4. log bilateral decision
5. run confidence check with effective indices
6. run calculation with effective indices
7. preserve existing scoring/output flow

### UI design
In `KeyMetricsEditor`, reuse the existing keypoint library import to derive and display mirrored left/right sets from the selected `keypoint_indices`. This keeps the admin UI aligned with the actual runtime behavior.

## Validation

1. Test a left-break Slant clip
   - auto-detect should resolve to left when no override or route direction is forcing a side
   - metrics should populate normally

2. Test a right-break Slant clip
   - auto-detect should resolve to right
   - the same node should work without duplication

3. Confirm logs show the chosen side and confidence comparison

4. Confirm `force_left` and `force_right` still override auto-detect

5. Confirm `route_direction` still takes priority over confidence-based auto-detect when provided

6. Confirm no regressions in:
   - progress updates
   - temporal smoothing
   - phase windowing
   - metric calculations other than chosen-side indices
   - cancellation
   - result persistence

## Expected outcome

After this change, one Slant node can support both left-break and right-break footage. The pipeline will prefer explicit overrides first, then route direction when supplied, and otherwise choose the stronger side automatically from keypoint confidence, while the AthleteLab editor clearly shows the left/right index mappings the pipeline will use.
