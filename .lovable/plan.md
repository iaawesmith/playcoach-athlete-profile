

## Use Abbreviated Position on ProCard

### Change
In `src/features/builder/components/ProCard.tsx`, line 98: replace `{positionLabel || "--"}` with `{position || "--"}` so the badge shows "QB", "WR", etc. instead of "Quarterback", "Wide Receiver".

The `positionLabelMap` and `positionLabel` variable can also be removed since they're no longer used.

### Files modified
- `src/features/builder/components/ProCard.tsx`

