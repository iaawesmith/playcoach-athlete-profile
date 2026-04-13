
Fix the Badges tab icon tray so it opens fully inside the visible form area instead of spilling off the right side.

1. Update `src/features/athlete-lab/components/BadgesEditor.tsx` in `renderEmojiPicker`:
   - Keep the trigger wrapper `relative`.
   - Replace the current tray anchoring (`left-0`) with a leftward-opening position (`left-auto right-0`) so the panel expands back into the form.
   - Add a small extra left nudge only if needed, since this icon field sits on the far-right side of the row.

2. Keep the tray easy to use:
   - Preserve the contained width/height behavior so the picker remains scrollable on smaller screens.
   - Keep the click-outside backdrop and current z-index behavior.

3. Verify only this bug is affected:
   - Check both “new badge” and “edit badge” icon pickers.
   - Confirm the full emoji grid is visible, no columns are cut off, and all options can be selected without horizontal clipping.

Technical details
- Root cause: the picker is still anchored from the trigger’s left edge, but the trigger lives near the editor’s right boundary.
- Scope should stay to one file: `src/features/athlete-lab/components/BadgesEditor.tsx`.
- No data, copy output, or badge logic changes.
