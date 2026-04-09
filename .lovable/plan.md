

## Plan: Fix Knowledge Base Text Readability + Improve Paste from Claude

### Problem
The `.prose-admin` CSS class uses dark-theme color tokens (`hsl(var(--on-surface))` = near-white, `hsl(var(--on-surface-variant))` = light grey). On the white editor background, this makes text invisible or very faint.

### Changes

**1. Fix text colors in `src/index.css` (prose-admin rules)**

Replace all color references with dark colors appropriate for a white background:
- `h3`, `h4`, `strong` → `color: #1a1a1a` (near-black)
- `p`, `ul`, `ol` → `color: #333333` (dark grey, fully readable)
- `li` → inherit from parent

**2. Improve paste-friendliness in `HelpDrawer.tsx`**

Add an `onPaste` handler on the contentEditable div that intercepts paste events and:
- Tries `text/html` first from clipboard (preserves headings, bold, lists, links from Claude)
- Strips problematic inline styles (background colors, font-family, font-size, color) that Claude/browsers inject, keeping only structural formatting (bold, italic, lists, headings, links)
- Falls back to `text/plain` with basic line-break preservation if no HTML available

This means when you copy formatted text from Claude (with headings, bold, bullets), the structure pastes cleanly without bringing Claude's light-theme colors or fonts into the editor.

### Technical Detail

The paste handler will:
1. `e.preventDefault()` to block default paste
2. Get `text/html` from `clipboardData`
3. Parse it into a temporary DOM element
4. Walk all elements, removing `style` attributes (or selectively stripping `color`, `background`, `font-family`, `font-size`)
5. Insert the cleaned HTML via `document.execCommand('insertHTML', false, cleanedHtml)`

### Files Modified
- `src/index.css` — update `.prose-admin` color values
- `src/features/athlete-lab/components/HelpDrawer.tsx` — add `onPaste` handler

