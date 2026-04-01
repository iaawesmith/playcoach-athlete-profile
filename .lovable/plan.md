

## ProCard Refinements — Match Reference Layout

Adjustments to close the gap between our current card and the reference image. No structural changes, just sizing and spacing tweaks.

### Changes to `src/features/builder/components/ProCard.tsx`

1. **Increase name font size**: `text-4xl` → `text-5xl` (48px) to match the bolder, larger name in the reference.

2. **Update physical attribute labels**: Change from abbreviations ("HT", "WT", "40") to full words ("HEIGHT", "WEIGHT", "40-YD"). Bump label size from `text-[8px]` to `text-[10px]`.

3. **Increase physical attribute values**: `text-lg` → `text-xl` for a heavier presence matching the reference.

4. **Add a subtle separator line** between the name and the physicals row: a `border-t border-white/10` on the physicals container, with `pt-3` above the stats.

5. **Tighten badge-to-name spacing**: `mb-4` → `mb-3`.

6. **Increase bottom padding**: `p-4` → `p-5` on the bottom info container.

7. **Deepen gradient overlay**: Strengthen the gradient so the bottom info zone has a more solid dark backing — change `via-surface/60` to `via-surface/80` for better contrast behind text when a photo is present.

### Files modified
- `src/features/builder/components/ProCard.tsx`

