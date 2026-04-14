

## Fix: Double Scrollbar on Reference, Training Status, and Scoring Tabs

### Root Cause

The layout hierarchy is:
```text
AthleteLab (h-screen, overflow-hidden)
  └─ flex container (flex-1, min-h-0)
       └─ div.flex-1.min-w-0          ← NO height constraint, NO overflow control
            └─ NodeEditor (flex-1, h-full, overflow-y-auto)  ← intended scroll container
```

The intermediate wrapper div at line 94 in `AthleteLab.tsx` (`flex-1 min-w-0`) lacks `overflow-hidden` and an explicit height constraint. When tab content is tall enough, both this wrapper and the NodeEditor's `overflow-y-auto` div produce scrollbars.

### Fix

**File: `src/features/athlete-lab/AthleteLab.tsx` (line 94)**

Add `overflow-hidden` to the wrapper div so only the NodeEditor's scroll container is active:

```
<div className="flex-1 min-w-0 overflow-hidden">
```

This single class addition ensures that only the inner `overflow-y-auto` on NodeEditor produces a scrollbar. The outer div clips instead of generating its own.

### Why only some tabs

Tabs with more content (Reference, Training Status, Scoring) push the content height past the viewport, triggering the second scrollbar on the wrapper. Shorter tabs don't overflow enough to make it visible.

