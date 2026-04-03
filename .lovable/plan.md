

## Convert Position & Details to 3-Column Dropdown Row

### What changes

Replace the current "Position & Details" section (position pill-grid on its own row + Jersey/Class Year 2-col row below) with a single **3-column evenly spaced row**: **Position** (dropdown) → **Jersey #** (input) → **Class Year** (dropdown).

### Changes in `src/features/builder/components/IdentityForm.tsx`

**Lines 592–626** — Replace the entire "Position & Details" section:

1. Remove the position pill-button grid (lines 596–615).
2. Remove the `grid-cols-2` row with Jersey # and Class Year (lines 617–625).
3. Replace with a single `grid grid-cols-3 gap-4` containing:
   - `SelectCard` for **Position** — options from the `positions` array, with a "Select..." placeholder
   - `InputCard` for **Jersey #** — same as current
   - `SelectCard` for **Class Year** — same as current

Position becomes a native `<select>` dropdown (using the existing `SelectCard` component) instead of the pill-toggle grid, saving vertical space.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

