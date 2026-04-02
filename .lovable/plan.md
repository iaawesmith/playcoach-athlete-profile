

## Fix Height Input + Suffix Alignment + Decimal Support

Three bugs, all in `IdentityForm.tsx` with a small store default change.

### 1. Height stays at 5'2" — `HeightInputCard` bug

The problem: when the user types `62`, it's parsed as 62 total inches → `5'2"`. The input interprets digits as total inches, but users expect to type feet and inches directly (e.g. `62` meaning 6 feet 2 inches).

**Fix**: Change parsing logic. When user types `62`, treat the first digit as feet and remaining as inches: `6'2"`. For single digit `6`, store as `6'0"`. For three digits like `511`, parse as `5'11"`. Specifically: last two digits = inches (if ≤ 11), first digit(s) = feet.

Alternatively (simpler, less error-prone): split into two inputs side by side — a feet field and an inches field. This removes all ambiguity. Label: "Height", two small inputs: `[6] ft  [2] in`.

### 2. Suffix pushed to far right — `NumericInputCard`

The `w-full` on the input stretches it across the entire row, pushing the suffix (`"`, `lbs`) to the far right edge. 

**Fix**: Remove `w-full` from the input, use `flex-1 min-w-0` instead, and change the flex container to not justify between. The suffix `ml-1` is fine — it just needs the input to not fill 100% width. Actually the real fix is simpler: change the input to `w-auto` and let flex handle natural sizing so the suffix sits right after the text. Best approach: use a wrapper where the input auto-sizes to its content width.

Cleanest solution: make the input `flex-1` (it already is via `w-full` effectively) but the suffix should sit right after the value, not at the edge. The issue is `w-full` makes the input take all space. Fix: change to a pattern where the input width matches content — use a hidden span to measure text width, or simply remove `w-full` and set a reasonable `max-w` on the input so it doesn't stretch.

Simplest fix: Keep layout but put the suffix **inside** the input visually by using an `input` with `text-align: left` and `width: auto`, and wrapping in a flex container without `w-full` on the input. Or: remove `w-full`, add `flex-shrink` to input so it only takes needed space.

### 3. Wingspan shows `68` not `6'8"` or `68"`

The store default is `"6'8\""` but the `NumericInputCard` strips non-digits on every keystroke (`replace(/[^\d.]/g, "")`). On initial render, the value `6'8"` displays with the `"` suffix, but the stored value includes the quote marks which get stripped. The real issue: store defaults have formatted values (`"6'8\""`) but the input strips to digits only, so on first edit the formatting is lost and raw `68` is stored.

**Fix**: Store raw numeric values in defaults (e.g. `wingspan: "80"` for 80 inches, or `"6.67"` for 6'8" in feet). But that changes semantics. Better: keep the display suffix approach but store only the number. Update store defaults to raw numbers: `vertical: "38.5"`, `wingspan: "80"`, `handSize: "9.5"`, `weight: "195"`, `height` split into feet/inches.

### Plan

**`src/store/athleteStore.ts`**: Change defaults to raw numeric values:
- `height: "74"` (total inches, 6'2" = 74)
- `weight: "195"` (no "lbs")
- `vertical: "38.5"` (no quote mark)
- `wingspan: "80"` (inches, no formatting)
- `handSize: "9.5"` (no quote mark)

**`src/features/builder/components/IdentityForm.tsx`**:

1. **HeightInputCard** → Replace with two side-by-side small inputs: Feet and Inches. Store as total inches string. Display in preview as `X'Y"`. This eliminates parsing ambiguity entirely.

2. **NumericInputCard suffix alignment** → Instead of `w-full` on the input, use a pattern where the input and suffix are grouped tightly:
   - Input: remove `w-full`, add `bg-transparent outline-none text-right` or keep left-aligned but auto-width
   - Simplest: keep the input as `flex-1` but add the suffix as inline text right after with no gap expansion. The fix is actually: the container uses `flex items-center` which is correct, but `w-full` on input pushes suffix to edge. Change input to not have `w-full` — just let it take natural width within flex. Add `min-w-0 flex-1` and the suffix stays adjacent.
   
   Actually after re-reading: `w-full` + `flex` means the input takes all remaining space, suffix goes to the end. The fix: remove `w-full` from the input element inside NumericInputCard and InputCard (when suffix is present). Let flex-1 handle it but suffix should be right after content, not at edge. Best: make the input and suffix a tight inline group where the suffix follows the cursor.

**`src/features/builder/components/IdentityPreview.tsx`**: Update preview to format raw values — append `"` to vertical/wingspan/handSize, append ` lbs` to weight, convert total inches to `X'Y"` for height.

### Files modified
- `src/store/athleteStore.ts`
- `src/features/builder/components/IdentityForm.tsx`
- `src/features/builder/components/IdentityPreview.tsx`

