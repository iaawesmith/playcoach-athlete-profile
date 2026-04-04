

## Remove ProCard Preview from Onboarding Setup

### What Changes
Remove the mini ProCard preview from `/onboarding/setup` so this page is purely a form. The first time the user sees their ProCard will be on `/onboarding/preview`, where the data they entered populates it live and auto-populate runs.

### Changes to `src/features/onboarding/steps/CoreSetup.tsx`

1. **Remove the right column card preview** — Delete lines 219–298 (the entire "Right: ProCard-style preview" section including school banner, photo placeholder, gradient, badges, name, physicals).

2. **Remove the two-column grid** — Change `grid grid-cols-1 md:grid-cols-2 gap-6` (line 91) to just a single-column `space-y-4` since there's no second column anymore. Remove the wrapping `<div className="space-y-4">` around the form fields (line 93) since the parent handles spacing.

3. **Expand input cards** — The form fields now have the full width. No width changes needed since they already use `w-full` inside grid cells.

4. **Remove unused variables** — Remove `displayName`, `formatHeight`, and the destructured `height`, `weight`, `fortyTime` from the store since they're only used by the removed card preview.

### Files Modified
- `src/features/onboarding/steps/CoreSetup.tsx`

