

## Remove help icon from tab selector row

**What changes**: Remove the small "?" (`help_outline`) icon that appears next to each tab name in the horizontal tab selector (lines 522–530 in `NodeEditor.tsx`). The green help button on the tab content header row will remain unchanged.

**File**: `src/features/athlete-lab/components/NodeEditor.tsx`
- Delete the `{t.key !== "test" && (...help_outline button...)}` block (lines 522–530)

One file, one small deletion.

