

## Fix: Emoji Picker Cut Off in Badges Tab

The emoji picker dropdown is clipped because it's inside a card container with `overflow-hidden` or because the `right-0` alignment pushes it against the edge. The picker also uses a small `max-w-[280px]` / `max-h-[200px]` grid that gets cut off.

### Changes (single file)

**`src/features/athlete-lab/components/BadgesEditor.tsx`** — `renderEmojiPicker` function (lines 207-222):

1. Change the picker from `absolute` positioning to a **fixed portal-style overlay** approach, or simpler: use `left-0` instead of `right-0` so it opens toward the available space (left-aligned under the icon button).

2. Increase `max-h-[200px]` to `max-h-[280px]` so all 16 emojis are visible without scrolling (4 columns x 4 rows fits perfectly).

3. Add a click-outside listener using a backdrop overlay `div` so the picker closes when clicking elsewhere.

4. The grid stays `grid-cols-4` with `w-9 h-9` buttons — all 16 emojis fit in 4 rows at the increased height.

Result: the picker opens fully visible, left-aligned under the icon button, with all options showing without scroll.

