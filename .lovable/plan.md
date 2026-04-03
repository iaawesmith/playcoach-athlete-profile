

## Fix Sticky Headers — Prevent Page-Level Scroll

### Problem
The grid container has `min-h-[calc(100vh-4rem)]` but no max height constraint. When content exceeds the viewport, the entire page scrolls — taking the "Identity Live Preview" and "Editing Identity" headers with it. The `overflow-hidden` and `overflow-y-auto` on the inner columns only work if the parent is height-constrained.

### Fix (`src/features/builder/BuilderLayout.tsx`, line 40)

Change the grid container from `min-h-[calc(100vh-4rem)]` to `h-[calc(100vh-4rem)]` so it locks to the viewport height. This forces the two columns to respect their `overflow-hidden` / `overflow-y-auto` settings, keeping headers pinned while content scrolls beneath them.

```
- <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-4rem)]">
+ <div className="grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-4rem)]">
```

One line change. Both column headers stay fixed; only the content areas beneath them scroll.

### Files modified
- `src/features/builder/BuilderLayout.tsx`

