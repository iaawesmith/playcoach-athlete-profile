

## Spell Out Measurable Labels in Identity Preview

Update the six `MeasurableTile` label props in `IdentityPreview.tsx` from abbreviations to full words:

| Current | New |
|---------|-----|
| HT | Height |
| WT | Weight |
| 40-YD | 40-Yard |
| Vertical | Vertical (no change) |
| Wingspan | Wingspan (no change) |
| Hand Size | Hand Size (no change) |

### Change — `src/features/builder/components/IdentityPreview.tsx`

Lines ~76–81: Update the `label` props on the three abbreviated tiles. Only HT → Height, WT → Weight, and 40-YD → 40-Yard need changing. The other three already use full words.

### Files modified
- `src/features/builder/components/IdentityPreview.tsx`

