

## Center "Coming Soon" Badges

The "Coming Soon" badges currently use `self-end` which pushes them to the bottom but they inherit `justify-items-center` from the grid so they should be horizontally centered. The issue is likely that `self-end` only affects vertical alignment. To ensure full centering within their grid row:

### Change in `src/features/onboarding/steps/RoleSelection.tsx`

- **Line 101**: Add `justify-self-center` to the Coming Soon badge span to explicitly center it horizontally, and keep `self-end` for vertical bottom alignment
- **Line 105**: Same for the invisible placeholder

This is a one-line class addition to ensure consistent horizontal centering of all three badges.

### Files Modified
- `src/features/onboarding/steps/RoleSelection.tsx`

