

## Suffix Spacing Adjustments + Wingspan Decimal

All changes in `NumericInputCard` inside `IdentityForm.tsx`.

### 1. Reduce suffix gap

The suffix currently has no explicit margin — it sits right after the dynamic-width input. The input width formula `Math.max(value.length, 1) * 0.6 + 0.5` adds `0.5em` of padding after the text, creating the gap.

**Fix**: Reduce the constant from `0.5` to `0.2` — this tightens the suffix closer to the number for all fields (weight/lbs, 40 time/s, vertical/", hand size/"). Wingspan spacing is already good per the user, so this universal change should work since they asked to move all the others closer.

### 2. Wingspan decimal

The store default for wingspan is `"80"` (whole number). Change to `"80.0"` so it displays with a decimal by default. The input already allows decimals via the `[^\d.]` regex.

### Files modified
- `src/features/builder/components/IdentityForm.tsx` — input width formula constant
- `src/store/athleteStore.ts` — wingspan default `"80"` → `"80.0"`

