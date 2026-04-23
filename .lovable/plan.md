Clarify the Run Analysis context field by renaming the visible “Route Direction” control to “Break Direction,” while keeping the submitted payload fully compatible with the existing pipeline contract.

### What will change

1. Rename the field in the Run Analysis form
   - Update the visible label in `src/features/athlete-lab/components/TestingPanel.tsx`
   - Change:
     - `Route Direction` → `Break Direction`
   - Keep the field in the same Analysis Context position so the workflow stays familiar

2. Update the option labels for clarity
   - Keep existing pipeline-safe underlying values for routed options:
     - `left` → `Athlete Breaks Left`
     - `right` → `Athlete Breaks Right`
     - `both` → `Both Directions` if the current admin/debug use case still needs it
   - Add a UI option for straight routes:
     - `No Break / Straight Route`
   - Do not introduce a new downstream pipeline value such as `none`

3. Use the safe compatibility path for straight routes
   - Follow the user’s preferred safe approach:
     - when `No Break / Straight Route` is selected, omit `route_direction` from `analysis_context`
   - This preserves current backend behavior and relies on the existing fallback path when the field is absent
   - No changes to pipeline, calibration, bilateral override logic, or downstream consumers

4. Add helper text under the field
   - Add concise instructional copy directly beneath the control in `TestingPanel.tsx`
   - Wording will explain that this refers to the athlete’s cut at the break point, affects which foot plants, and influences which side’s keypoints are measured
   - Include explicit straight-route guidance:
     - for straight routes with no break, select `No Break / Straight Route`

5. Keep copied/exported context text aligned
   - Update `copyContext()` in `TestingPanel.tsx` so the copied summary uses:
     - `Break Direction`
     - the new descriptive labels
   - For straight routes, the copied text should say `No Break / Straight Route`
   - This is only a display/copy change; it does not alter the backend payload contract

6. Adjust local typing safely
   - Update the local form state type in `TestingPanel.tsx` to support the extra UI-only straight-route selection
   - Update `AnalysisContext` in `src/services/athleteLab.ts` so `route_direction` can be omitted rather than always required
   - Keep all API calls routed through the service layer as they are now

### Implementation approach

- Introduce a UI-only selection state for break direction, likely something like:
  - `left | right | both | straight`
- Add a small mapping helper in `TestingPanel.tsx`:
  - `left/right/both` → include `route_direction`
  - `straight` → omit `route_direction`
- Apply that helper in both places where the analysis context payload is built:
  - main `buildContext()`
  - the reduced payload path when context toggles are minimized

### Files to update

- `src/features/athlete-lab/components/TestingPanel.tsx`
  - rename field label
  - update option labels
  - add helper text
  - add UI-only straight-route option
  - omit `route_direction` from payload when straight route is selected
  - update copied context text
- `src/services/athleteLab.ts`
  - make `AnalysisContext.route_direction` optional for type safety

### Validation after implementation

1. The Run Analysis form shows `Break Direction` instead of `Route Direction`
2. The options read:
   - `Athlete Breaks Left`
   - `Athlete Breaks Right`
   - `No Break / Straight Route`
   - and `Both Directions` only if retained
3. Selecting `No Break / Straight Route` does not send a new `route_direction` value to the backend
4. The submitted payload still uses `analysis_context.route_direction` for existing routed selections
5. No pipeline, calibration, or downstream logic is modified
6. Copied Analysis Context text reflects the new terminology and straight-route wording