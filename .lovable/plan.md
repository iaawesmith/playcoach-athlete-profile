

## Placeholder & PM Button Fixes

### 1. Form placeholders — change to zeros

**`src/features/builder/components/IdentityForm.tsx`**

Update placeholder values passed to `NumericInputCard`:
- Weight: `"195"` → `"0"`
- 40 Time: `"4.40"` → `"0.0"`
- Vertical: `"36.5"` → `"0.0"`
- Wingspan: `"76.0"` → `"0.0"`
- Hand Size: `"9.5"` → `"0.0"`

Lines 600–614.

### 2. ProCard physicals — change em-dash to matching defaults

**`src/features/builder/components/ProCard.tsx` lines 35–39**

Change the fallback display values:
- HEIGHT: `"—"` → `"0'0\""` (matching the 0 / 0 placeholder)
- WEIGHT: `"—"` → `"0"`
- 40 TIME: `"—"` → `"0.0"`

These render at normal opacity on the card (not 40% — they're in the actual value display).

### 3. PM button not visible — fix unselected state contrast

**`src/features/builder/components/IdentityForm.tsx` line 258**

The unselected period button uses `bg-surface-container-high` which is nearly invisible against the card background. Change to `bg-surface-container-highest` or add a subtle border so the inactive button is clearly visible as a clickable option. Both AM and PM should always be visually apparent as a toggle pair.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`
- `src/features/builder/components/ProCard.tsx`

