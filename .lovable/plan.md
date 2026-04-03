

## Match Team Color Card Height to School Card

**Problem**: The color swatch (`w-8 h-8` = 32px) makes the Team Color card taller than the School card, which only has a text-height input row.

**Fix in `src/features/builder/components/IdentityForm.tsx` (lines 546–561):**

1. Shrink the color swatch from `w-8 h-8` to `w-6 h-6` (24px) — closer to the text line height
2. Add `items-center` to the parent `flex gap-4` row (line 526) so both cards vertically align
3. Add `self-stretch` to the Team Color card wrapper so it matches the School card's height exactly instead of sizing to its own content
4. Keep `flex items-center gap-2` on the inner row so the swatch centers vertically with the hex input

**Changes:**
- Line 526: `flex gap-4` → `flex gap-4 items-stretch` (both cards stretch to same height)
- Line 546: Remove `style={{ minWidth: 160 }}`, add `min-w-[160px]` to className instead (cleaner)
- Line 557: `w-8 h-8` → `w-6 h-6` on the color swatch

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

