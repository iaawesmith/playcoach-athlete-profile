

## Plan: White Background Editor + Line Separator Button

### Changes (single file: `HelpDrawer.tsx`)

1. **Editor & Reader — white background, black text**
   - Both the contentEditable div (editing mode) and the read-only div (view mode) get `backgroundColor: '#ffffff'` and `color: '#1a1a1a'`.
   - Update the empty-state placeholder text to use a dark gray color instead of the current light variant.
   - Border stays subtle (gray tone adjusted for white context).

2. **Add "Horizontal Rule" toolbar button**
   - Add a new `ToolbarBtn` with the `horizontal_rule` Material Symbol icon after the Heading/Paragraph group.
   - onClick calls `execCommand("insertHorizontalRule")` which inserts an `<hr>` element.

3. **No other changes** — sidebar, header, drawer background, toolbar background all stay as-is.

### Technical Details

- `execCommand("insertHorizontalRule")` is the native browser command for inserting `<hr>` tags in contentEditable regions.
- The white background applies to both the editing and reading views so content looks consistent.
- May add a small CSS rule via className or inline style to ensure `<hr>` elements inside the editor render visibly on white background.

