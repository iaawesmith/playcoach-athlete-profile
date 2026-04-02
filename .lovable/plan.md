

## Add School + Team Color Fields to Identity Editor

The `school`, `schoolAbbrev`, and `teamColor` values are already in the Zustand store and destructured in the form — they're just missing their input fields.

### Change — `src/features/builder/components/IdentityForm.tsx`

Add a new row block after the media upload buttons (after line 211, inside the "Your Identity" section):

1. **School + School Abbreviation** — one row, `grid-cols-2`:
   - InputCard "School" → `school`
   - InputCard "Abbreviation" → `schoolAbbrev`

2. **Team Color** — one row, `grid-cols-2`:
   - InputCard "Team Color (Hex)" → `teamColor`
   - A live color swatch preview: small `w-10 h-10 rounded-xl` div with `backgroundColor` set to `teamColor` inline, inside a matching InputCard-style wrapper labeled "Preview". This gives immediate visual feedback as the athlete types their hex code.

Order inside "Your Identity" becomes: Names → Uploads → School/Abbrev → Team Color/Swatch.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

