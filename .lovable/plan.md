

## Widen Role Selection Cards

### Changes to `src/features/onboarding/steps/RoleSelection.tsx`

1. **Expand grid container**: Change `max-w-5xl` to `max-w-6xl` to give the overall background area more room
2. **Make cards equal width**: Replace the fixed `px-16 py-6` padding with `w-full py-6` so each card fills its grid column equally — all four cards will be the same width
3. **Add minimum height**: Add `min-h-[200px]` to ensure consistent vertical sizing across all cards (Coming Soon cards have an extra badge element)
4. **Justify content center**: Add `justify-center` to vertically center content within each card

### Files Modified
- `src/features/onboarding/steps/RoleSelection.tsx`

