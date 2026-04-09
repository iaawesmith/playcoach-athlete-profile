

## Plan: Optimize Table Paste Support in Knowledge Base Editor

### Problem
When pasting a table from Claude, the HTML `<table>` structure is preserved by the paste handler, but there are no CSS rules for tables inside `.prose-admin`, so they render as unstyled text blobs on the white background.

### Changes

**1. Add table styles to `src/index.css` (inside `.prose-admin`)**

Add rules for `table`, `th`, `td`, `thead`, `tbody`:
- `table`: full width, border-collapse, bottom margin
- `th`: bold, dark background (`#f3f4f6`), left-aligned, padding, bottom border
- `td`: padding, bottom border (`#e5e7eb`), vertical-align top
- `tr:last-child td`: no bottom border

This will make any pasted table render with clean light-grey header row, subtle row dividers, and proper cell padding — matching the look from the screenshot.

**2. Update paste handler in `HelpDrawer.tsx`**

The current handler strips `style` and `class` from all elements. Tables from Claude may also carry `width` attributes or inline widths that cause layout issues. Add `width` to the list of stripped attributes so tables default to full-width via CSS.

No other changes needed — the existing `text/html` paste path already preserves `<table>`, `<tr>`, `<th>`, `<td>` structure.

### Files Modified
- `src/index.css` — add `.prose-admin table/th/td` rules
- `src/features/athlete-lab/components/HelpDrawer.tsx` — strip `width` attribute in paste handler

