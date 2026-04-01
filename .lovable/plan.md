

## Remove Dead CTA Buttons from IdentityForm

The "Save Identity" and "Discard Changes" buttons at the bottom of the Identity form are non-functional. All fields already update the card live via Zustand. Remove them now; re-add a real save flow in Session 3 when database persistence is wired.

### Change — `src/features/builder/components/IdentityForm.tsx`

Remove the bottom CTA section (the `div` with `flex items-center gap-3 pt-4` containing "Discard Changes" and "Save Identity" buttons). This is roughly lines 199–214.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

