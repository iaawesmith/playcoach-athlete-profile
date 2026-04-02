

## Improve Field Label Visibility

The labels inside input cards currently use `font-medium` (weight 500) and `text-on-surface-variant` (#a8abaf). Against the `bg-surface-container-lowest` (#000000) card backgrounds, they're readable but require effort to scan — especially compared to labels outside cards (like "ACTION PHOTO") which sit on lighter surfaces.

### Change

Update **every** `<label>` inside input cards in `IdentityForm.tsx` from:

```
font-medium … text-on-surface-variant
```

to:

```
font-semibold … text-[#c0c3c7]
```

This bumps weight from 500 → 600 and brightness from #a8abaf → #c0c3c7 — a subtle lift that keeps the dim-label / bright-value hierarchy intact while making labels easier to scan. The change is consistent with the workspace design spec which lists `font-semibold` as the correct weight for sub-section labels.

There are ~15 label instances across the reusable card components (`InputCard`, `NumericInputCard`, `HeightInputCard`, `SelectCard`, `TextAreaCard`, `ToggleCard`, `RadioCard`) plus a few inline labels (Position radio, Star Rating, Commitment Status, Team Color Preview, Action Photo, School Logo). All share the same class pattern, so the find-and-replace is mechanical.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

