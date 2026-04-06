

## Improve Pulse preview scrolling and stack pinned cards vertically

**File: `src/features/builder/components/PulsePreview.tsx`**

Two changes:

1. **Smoother scrolling** (line 131): Add `scroll-smooth` to the scrollable content div and ensure the custom thin scrollbar is visible with `scrollbar-thin` class.

2. **Stack pinned cards vertically** (lines 154–158): Change the pinned container from horizontal scroll (`flex gap-2 overflow-x-auto`) to a vertical stack (`flex flex-col gap-2`). Remove `scrollbar-none`, `overflow-x-auto`, and `pb-1`. Also update `MiniPinnedCard` to remove the `min-w` / `max-w` constraints so cards stretch full width.

