

## Remove Field Borders from Identity Editor

All input cards and upload slots in `IdentityForm.tsx` use `border border-white/[0.12]`. Removing this will let the fields float on tonal contrast alone (`bg-surface-container` against the page `bg-surface`), aligning with the No-Line Rule aesthetic.

### Change — `src/features/builder/components/IdentityForm.tsx`

Find-and-replace all instances of `border border-white/[0.12]` with nothing (remove entirely). This affects:

- `InputCard` (line 48)
- `NumericInputCard` (line 90)
- `HeightInputCard` (line 134)
- `SelectCard` (line 171)
- `TextAreaCard` (line 210)
- `ToggleCard` (line 237)
- `TimeInputCard` (line 263)
- Action photo upload button (line 388)
- School logo upload button (line 410)
- Team color preview tile (line 434)
- Position radio group (line 451)
- Star rating block (line 529)
- Commitment status block (line 564)
- Any remaining instances

Also remove `hover:border-white/20` from the upload buttons (lines 388, 410) since there's no base border to transition from.

Keep the focus-within teamColor border behavior (handled by `input-card-focus` CSS class) — that still works independently.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

