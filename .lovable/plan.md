
Add optional athlete measurement inputs to the Run Analysis tab’s Analysis Context form and pass them through in `analysis_context` for future body-based calibration work, without changing database schema or current scoring/calibration behavior.

### What will be built

1. Extend the Run Analysis form in `src/features/athlete-lab/components/TestingPanel.tsx`
   - Add two optional measurement controls inside the existing Analysis Context panel:
     - `Athlete Height`
     - `Athlete Wingspan (Optional)`
   - Each measurement gets:
     - numeric input
     - unit dropdown with `inches` and `cm`
   - Default unit for both: `inches`
   - Leave both blank by default so body-based calibration is clearly optional

2. Extend the analysis context payload in `src/services/athleteLab.ts`
   - Update `AnalysisContext` so it can carry:
     - `athlete_height?: { value: number; unit: "inches" | "cm" }`
     - `athlete_wingspan?: { value: number; unit: "inches" | "cm" }`
   - Keep existing context fields unchanged
   - Only include these objects when the corresponding numeric field has a valid value

3. Wire form submission to include the new fields
   - Update `buildContext()` in `TestingPanel.tsx` so the submitted payload matches the requested shape:
     - `analysis_context.athlete_height = { value, unit }`
     - `analysis_context.athlete_wingspan = { value, unit }`
   - If both are blank, no measurement objects are sent and the run behaves exactly as it does today

4. Add forward-looking code documentation
   - Add concise comments near the new state/build logic explaining:
     - these fields are temporary per-test inputs for admin/testing workflows
     - once athlete onboarding/profile data exists, the values should auto-populate from athlete profile instead of being entered manually in Run Analysis

### Current state confirmed

- The Run Analysis UI lives in `src/features/athlete-lab/components/TestingPanel.tsx`
- The current Analysis Context already sends:
  - `camera_angle`
  - `people_in_video`
  - `route_direction`
  - `catch_included`
  - `catch_status`
  - `athlete_level`
  - `focus_area`
- The payload shape is defined in `src/services/athleteLab.ts`
- The current invoke call already passes `analysis_context` through to the edge function body, so no client transport change is needed beyond type expansion
- The current tooltip/copy already states this context will eventually come from onboarding, which aligns with the new comment requirement

### Implementation details

#### 1) Form state additions
In `TestingPanel.tsx`, add local state for:
- `athleteHeight` as a string input value
- `athleteHeightUnit` defaulting to `"inches"`
- `athleteWingspan` as a string input value
- `athleteWingspanUnit` defaulting to `"inches"`

Using string state preserves clean numeric-input editing behavior and avoids accidental `0` values.

#### 2) UI layout
Add a new subsection in the Analysis Context panel, below existing context controls and above the submit area, using the current custom styling conventions already present in `TestingPanel.tsx`.

For each field:
- label in existing uppercase microcopy style
- numeric input with placeholder examples like `70` / `178`
- unit select beside the input
- short helper text:
  - Height: used for future body-based calibration
  - Wingspan: optional precision enhancer for future body-based calibration

Also include brief empty-state guidance such as:
- “If left blank, body-based calibration is unavailable for this test.”

#### 3) Payload construction rules
Update `buildContext()` so:
- base context remains identical
- height is appended only if the numeric field is non-empty and valid
- wingspan is appended only if the numeric field is non-empty and valid

Planned output:
```ts
{
  camera_angle,
  people_in_video,
  route_direction,
  catch_included,
  catch_status,
  athlete_level,
  focus_area,
  athlete_height: { value: 70, unit: "inches" },
  athlete_wingspan: { value: 72, unit: "inches" }
}
```

If a value is blank, omit that property entirely rather than sending empty objects or null-like placeholders.

#### 4) Type updates
In `src/services/athleteLab.ts`:
- introduce a small reusable measurement type for clarity
- expand `AnalysisContext` to include the two optional measurement objects
- keep the rest of the service contract unchanged so existing callers continue to work

### Files to update

- `src/features/athlete-lab/components/TestingPanel.tsx`
- `src/services/athleteLab.ts`

### Out of scope and preserved behavior

This change will not:
- modify athlete tables or any backend schema
- build athlete profile or onboarding UI
- change metric calculations
- change calibration logic
- add global/unit-preference settings

It is strictly a Run Analysis form and payload enhancement for future downstream calibration work.

### Validation

After implementation, verify:
1. Run Analysis shows both new optional measurement fields
2. Each field supports unit selection between inches and cm
3. Default unit is inches for both fields
4. Leaving both blank still allows analysis to run normally
5. Entering one or both values includes the correct nested objects in `analysis_context`
6. Existing fields and current analysis flow still work unchanged
7. Code comments clearly note future auto-population from athlete profile/onboarding

### Technical notes

- The current lightweight edge function `supabase/functions/athlete-lab-analyze/index.ts` will tolerate extra `analysis_context` fields even before it actively uses them
- No database migration is required because this data is only being passed through the existing function invocation payload at this stage
