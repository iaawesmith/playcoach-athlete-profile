

## Align All Three Rows Into a Consistent 2-Column Grid

**Problem**: The first two rows (First/Last Name, Action Photo/School Logo) use `grid grid-cols-2 gap-4`, but the third row (School / Team Color) uses `flex` with different sizing — so the columns don't align vertically.

**Fix in `src/features/builder/components/IdentityForm.tsx` (lines 526–562)**:

Replace the `flex gap-4 items-stretch` container with `grid grid-cols-2 gap-4` to match the rows above. This ensures:
- Left column: First Name → Action Photo → School — all same width
- Right column: Last Name → School Logo → Team Color — all same width

Remove `flex-1` wrapper around SchoolAutocomplete and `min-w-[160px]` from Team Color card — the grid handles equal sizing automatically.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

