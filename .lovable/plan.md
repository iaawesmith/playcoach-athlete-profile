

## Center and Inset the AM/PM Dropdown

**`src/features/builder/components/IdentityForm.tsx` lines 241–258**

Two changes to the `TimeInputCard` component:

1. **Vertically center the dropdown** — Change the flex container from `items-center` to `items-end` isn't needed; the `items-center` is already correct for vertical centering. The issue is the dropdown needs to be vertically centered relative to the full card box, not just the input row. Move the `<select>` outside the input row `div` and make the card use a relative/absolute positioning approach — or simpler: keep the current flex row but add `items-center` and adjust padding.

Actually, looking at the screenshot, the dropdown sits at the far right edge of the card. The fix:

1. **Add right padding/margin** — Add `mr-2` to the select to pull it inward from the card edge.
2. **Ensure vertical centering** — The flex row already has `items-center`. To center the dropdown relative to the entire card (not just the text row), restructure the card to use `flex items-center justify-between` at the card level, with label+input on the left and the dropdown on the right.

**Revised layout for `TimeInputCard` (lines 237–260):**
- Card becomes `flex items-center` with the label+input grouped in a left `div` and the select on the right with `mr-1`.
- This vertically centers the dropdown to the card box and pulls it inward.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

