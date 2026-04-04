

## Rename "Class Year" to "Class" with Freshman–Senior Values

### Changes

**1. `src/features/onboarding/steps/CoreSetup.tsx`**
- Rename `CLASS_YEARS` to `CLASS_OPTIONS` with values: `["Freshman", "Sophomore", "Junior", "Senior"]`
- Change label from "Class Year" to "Class"

**2. `src/features/builder/components/IdentityForm.tsx`**
- Change `classYears` array from year strings to `["Freshman", "Sophomore", "Junior", "Senior"]`
- Change label from "Class Year" to "Class"

**3. `src/features/builder/components/ProCard.tsx`**
- Change display from `Class of {classYear}` to just `{classYear}` (since the value is now "Freshman" etc., no prefix needed)

**4. `src/features/builder/components/ScrapeFill.tsx`**
- Update the label mapping from `"Class Year"` to `"Class"`

### Notes
- The `classYear` field name in the Zustand store stays the same (no store changes needed — it's just a string field)
- Existing data with year values like "2025" will still display but won't match any pill/option — users would need to re-select

