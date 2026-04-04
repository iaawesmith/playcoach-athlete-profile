

## Fix "Coming Soon" Badge Positioning and Spacing

### Problem
The grid row template `grid-rows-[64px_28px_48px_40px]` doesn't give enough room at the bottom for the badge, and the overall vertical spacing feels cramped.

### Changes to `src/features/onboarding/steps/RoleSelection.tsx`

1. **Increase badge row height**: Change grid template from `grid-rows-[64px_28px_48px_40px]` to `grid-rows-[64px_28px_40px_1fr]` — the last row becomes flexible (`1fr`) so the badge naturally sits at the bottom of the card
2. **Increase card min-height**: Bump from `min-h-[260px]` to `min-h-[280px]` for more breathing room
3. **Increase card vertical padding**: Change `py-6` to `py-8` to push content away from edges
4. **Badge alignment**: Keep `self-end` on the badge/placeholder so it anchors to the bottom of its flexible row

This ensures "Coming Soon" badges sit consistently at the bottom of each card with clear separation from the description text.

### Files Modified
- `src/features/onboarding/steps/RoleSelection.tsx`

