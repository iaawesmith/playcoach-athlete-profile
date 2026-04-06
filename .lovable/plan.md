

## Match school + logo layout to onboarding style

**File: `src/features/builder/components/IdentityForm.tsx`**

Two changes:

1. **Move SchoolAutocomplete + logo into a single row** (around lines 684–710): Wrap the `SchoolAutocomplete` and the school logo upload button in a `grid grid-cols-[4fr_1fr] gap-4` container — the school search field takes most of the width, and a smaller square box shows the school logo (or upload prompt) on the right, matching the onboarding CoreSetup pattern.

2. **Remove the school logo from the 3-column photo grid** (lines 657–681): Remove the third column (school logo button) from the photo upload grid, changing it from `grid-cols-3` to `grid-cols-2` so only Action Photo and Profile Picture remain.

The logo box in the new row will keep the same upload/display logic (click to upload, hover overlay, loading state) — just moved to sit beside the school search field.

