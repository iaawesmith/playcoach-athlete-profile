

## Remove Misleading Placeholder from Time Input

The `TimeInputCard` in `IdentityForm.tsx` (line 272) has `placeholder="7:00"` which looks like pre-filled data. Simple fix: remove the placeholder entirely so the field shows blank when empty. The label "TIME" already tells the user what to enter.

### Change — `src/features/builder/components/IdentityForm.tsx`

Line 272: Remove `placeholder="7:00"` from the time input, or replace with an empty string.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

