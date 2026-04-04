

## Make Role Cards Wider, Not Taller

The cards currently have `px-12 py-8` which made them taller. To make them wider without adding height:

### Change in `src/features/onboarding/steps/RoleSelection.tsx`

- **Line 66**: Increase `max-w-4xl` to `max-w-5xl` so the grid container allows more horizontal space
- **Line 75**: Change padding from `px-12 py-8` to `px-16 py-6` — more horizontal padding, slightly less vertical

This gives each card more horizontal breathing room while keeping them compact vertically.

### Files Modified
- `src/features/onboarding/steps/RoleSelection.tsx`

