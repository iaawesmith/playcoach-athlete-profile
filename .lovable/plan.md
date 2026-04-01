

## Style Preview Label as Bold Heading, Aligned with Card

The "Identity Preview" label currently uses the sub-section label style (`text-[10px] font-semibold tracking-[0.4em]`). It should match the old "Your Card" heading treatment and left-align with the card itself, not the column padding.

### Change — `src/features/builder/BuilderLayout.tsx`

**Label styling** (line 66): Change from the tiny label style to a proper heading:
- `text-sm font-bold uppercase tracking-widest text-on-surface-variant`

**Alignment**: The column has `p-8` (32px padding). The ProCard renders inside that padding and is already left-aligned. The label row (line 65) sits inside the same padding, so it already aligns with the card's left edge. No padding changes needed — the current alignment is correct. The visual misalignment the user perceives is likely because the label is so small it feels disconnected. Making it bolder will anchor it visually to the card below.

If the label still feels offset after the weight increase, we can add a `max-w-sm` constraint to the label row to match the ProCard's max width — but that's only needed if the label stretches wider than the card on large screens.

### Files modified
- `src/features/builder/BuilderLayout.tsx`

