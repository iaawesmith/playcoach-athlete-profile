

## Change Selected Pill Text to White + Bold

### Problem
When a position or class year pill is selected, the text uses `text-surface` (dark) on the teamColor background. User wants white bold text instead.

### Changes to `src/features/onboarding/steps/CoreSetup.tsx`

1. **Line 161**: Change `"text-surface"` to `"text-white font-bold"` for selected position pills
2. **Line 184**: Change `"text-surface"` to `"text-white font-bold"` for selected class year pills

Both already have `font-black` from the shared class, so `font-bold` is redundant — the key fix is replacing `text-surface` with `text-white`.

### Files Modified
- `src/features/onboarding/steps/CoreSetup.tsx`

