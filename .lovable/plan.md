

## Plan: Convert Reference Video Quality Guide to collapsible expander

### Where
Single-file edit: `src/features/athlete-lab/components/NodeEditor.tsx`, inside `EliteVideosEditor`. The existing callout block (the entire blue-bordered guide + the "Sourcing Ideal References" sub-card below it) gets wrapped in a collapsible container. All inner content stays byte-identical.

### Visual design — collapsed (default)

```text
┌─ Videos tab ───────────────────────────────────────────────────────┐
│                                                                     │
│  ┌─ COLLAPSED HEADER (bg #0f1e2e, border-l-4 #3b82f6, p-3) ──────┐│
│  │ ◉ info   REFERENCE VIDEO QUALITY GUIDE                    ▾   ││
│  │          Solo athlete, sideline angle, full-body visibility,   ││
│  │          yard lines visible — click to expand checklist        ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  Reference Videos                          3 of 3+ recommended    │
│  └ video list / empty state / Add Video button (visible above fold)│
└────────────────────────────────────────────────────────────────────┘
```

### Visual design — expanded

```text
┌─ Videos tab ───────────────────────────────────────────────────────┐
│  ┌─ EXPANDED HEADER (same styling, chevron rotated 180°) ────────┐│
│  │ ◉ info   REFERENCE VIDEO QUALITY GUIDE                    ▴   ││
│  │          Solo athlete, sideline angle, full-body visibility,   ││
│  │          yard lines visible — click to expand checklist        ││
│  │ ───────────────────────────────────────────────────────────── ││
│  │  [existing Ideal Criteria + Avoid two-column grid]             ││
│  │  [existing Why This Matters section]                           ││
│  │  [existing Using the Reference as a Diagnostic Tool section]   ││
│  └────────────────────────────────────────────────────────────────┘│
│  ┌─ Sourcing Ideal References muted sub-card (existing) ─────────┐│
│  │ ◉ search  WHERE TO FIND GOOD REFERENCE FOOTAGE                 ││
│  │   • position coach YouTube channels … etc                      ││
│  └────────────────────────────────────────────────────────────────┘│
│  Reference Videos …                                                │
└────────────────────────────────────────────────────────────────────┘
```

Both the main guide AND the sourcing sub-card are hidden when collapsed — they are paired content and should appear/hide together.

### Interaction
- Entire header row (icon + title + subtitle + chevron) is a single `<button>` — clickable across the full width for an easy hit target.
- Chevron: Material Symbol `expand_more`, 20px, `text-blue-300/70`, rotates 180° on expand via `transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`.
- `aria-expanded` on the button, `aria-controls` pointing at the content region.
- Hover: header background lightens slightly via `hover:bg-blue-500/5`.

### State persistence
Implemented — low cost. New local state inside `EliteVideosEditor`:

```ts
const STORAGE_KEY = 'athleteLab.videoGuideExpanded';
const [guideExpanded, setGuideExpanded] = useState<boolean>(() => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === 'true';
});
useEffect(() => {
  window.localStorage.setItem(STORAGE_KEY, String(guideExpanded));
}, [guideExpanded]);
```

Default: collapsed (`false`). If an admin expands it, that preference sticks across sessions and across nodes. Single global key — admin-level pref, not per-node, since the guide content is identical for every node.

### Style spec (collapsed header)
- Same outer container as today: `rounded-xl border border-blue-500/30 border-l-4 border-l-blue-400`, `style={{ backgroundColor: '#0f1e2e' }}`
- Reduced padding when collapsed: `p-3` (vs current `p-5`) — keeps it compact (one icon + two text lines = ~64px tall total)
- Header `<button>` layout: `flex items-start gap-3 w-full text-left`
- Title row: `info` icon (20px, `text-blue-300`) + `REFERENCE VIDEO QUALITY GUIDE` (`text-[11px] font-bold uppercase tracking-widest text-blue-200`) on one line, chevron pushed right with `ml-auto`
- Subtitle: new wording — `Solo athlete, sideline angle, full-body visibility, yard lines visible — click to expand checklist` (`text-xs text-on-surface-variant mt-1 leading-snug`)

### Style spec (expanded)
- Padding becomes `p-5` (current value) so the inner sections breathe
- A `border-t border-blue-500/20 mt-4 pt-4` separator above the expanded content area (visually splits header from the checklist content)
- All four inner sections (Ideal/Avoid two-column, Why This Matters, Diagnostic Tool) render inside the conditional block exactly as they do today — zero content changes
- "Sourcing Ideal References" sub-card moves inside the same conditional so it shows/hides with the main guide

### What I will NOT do
- No content changes to any of the four inner sections or the sourcing sub-card
- No new components or files — everything stays inline in `EliteVideosEditor`
- No animation library — pure CSS transition on the chevron only; the content reveal is instant (no height animation, which always janks with variable content)
- No changes to other tabs, the video list, the add/edit flow, or the empty state
- No keyboard shortcut binding (just standard button semantics + `aria-expanded`)

### Files touched
- `src/features/athlete-lab/components/NodeEditor.tsx` — wrap the existing callout + sourcing card in a collapsible structure, add ~15 lines of state/effect, update the header markup; replace `p-5` with conditional `p-3`/`p-5`. Net diff ~40 lines.

### Risks
None meaningful. Pure presentational + a single localStorage read/write that gracefully no-ops in SSR-style environments via the `typeof window` guard.

