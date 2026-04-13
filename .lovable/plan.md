

## Plan: Add Readiness Score Tag to Node Sidebar

### What changes

**1. Export readiness helpers from `NodeReadinessBar.tsx`**
- Export `computeCategories`, `computeScore`, and `scoreColor` so the sidebar can reuse the same scoring logic.

**2. Update `NodeSidebar.tsx`**
- Move the position tag (WR/QB/RB) closer to the node name — place it immediately after the name text instead of pushed to the right with `flex-1`.
- Add a new readiness percentage pill after the position tag, right-aligned:
  - Shows `73%` or `100%` etc.
  - Green (`#22c55e`) background at 100%, amber (`#f59e0b`) at 60-99%, red (`#ef4444`) below 60% — matching the progress bar color logic.
  - Small pill style matching the position tag aesthetic.
- Layout becomes: `[status dot] [Node Name] [WR] ... [73%] [🗑]`

### Technical details

- Import `computeCategories`, `computeScore`, `scoreColor` from `NodeReadinessBar`.
- Compute score per node inline using `useMemo` or direct call since nodes are already in memory.
- The readiness pill uses the same `scoreColor()` function for background tint (at 20% opacity) and text color.

No database changes. No new files. Two files modified.

