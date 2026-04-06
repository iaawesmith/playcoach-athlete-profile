

## Split School field into School + School Logo on CoreSetup

**What changes:** The School search field currently spans the full width. Split it into a `grid-cols-2` row — School search on the left, School Logo preview on the right.

### Implementation

**File: `src/features/onboarding/steps/CoreSetup.tsx`**

Replace the current full-width school search `div` (lines 87–121) with a `grid grid-cols-2 gap-3` wrapper:

- **Left column**: The existing school search input and dropdown (unchanged functionality, just wrapped in the grid cell). The dropdown `ul` positions relative to this cell.
- **Right column**: A new "School Logo" card matching `cardStyle`, with:
  - Label: "SCHOOL LOGO" (same `labelClass`/`labelColor`)
  - Content: If `schoolLogoUrl` exists in the store, show `<img>` of the logo (centered, ~40×40px, `object-contain`). If not, show a muted placeholder icon (`shield`) with subtle "Auto-populated" text in `text-[10px] text-on-surface-variant`.

The `wrapperRef` for outside-click detection wraps only the left school search cell (not the logo cell).

No new state or store changes needed — `schoolLogoUrl` is already set by `handleSelectSchool` via `setAthlete({ schoolLogoUrl: opt.logoUrl })`.

