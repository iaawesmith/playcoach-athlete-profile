

## Match logo box height to school field height

**File: `src/features/builder/components/IdentityForm.tsx`**

**Line 684:** On the logo `<button>`, remove `aspect-square` so it no longer forces a square shape. The `grid-cols-[4fr_1fr]` parent already constrains its width, and the grid will naturally make both children the same height (grid rows stretch by default).

One class removal, no other changes needed.

