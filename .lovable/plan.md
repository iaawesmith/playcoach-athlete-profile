

## Evenly Space Eligibility Fields

### Change
In `src/features/builder/components/IdentityPreview.tsx`, line 155: change the flex container from `flex items-center gap-4` to `grid grid-cols-3` so all three columns (Years Left, Transfer, Redshirt) get equal width.

Each child `<div>` (lines 156, 160, 166) stays unchanged — just evenly distributed by the grid.

### Files modified
- `src/features/builder/components/IdentityPreview.tsx`

