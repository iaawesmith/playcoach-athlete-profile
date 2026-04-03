

## Placeholder & Default Value Refinements

### 1. First Name / Last Name — add placeholders
**`InputCard` component (line 35)**: Add optional `placeholder` prop. Style with `placeholder:text-on-surface/40`.

**Lines 475–476**: Pass `placeholder="Your"` to First Name, `placeholder="Name"` to Last Name.

### 2. Jersey # — placeholder "0"
**Line 581**: Pass `placeholder="0"` to Jersey # InputCard.

### 3. Height placeholders — 40% opacity
Already using `placeholder:text-on-surface/40` on lines 149 and 157. The placeholders "6" and "2" should already render at 40%. If they appear full opacity, the issue is that when `totalInches === 0`, `feet` computes to `0` and `inches` to `0`, and the value shows `""` — the placeholder should show. Will verify the placeholder class is correct and ensure it's visually at 40%.

### 4. National Rank / Position Rank — placeholder "0"
**Lines 660–671**: Add `placeholder="0"` to both InputCard instances. Requires the `placeholder` prop addition from step 1.

### 5. Eligibility Remaining — placeholder "0"
**Line 688**: Already shows empty when `eligibilityYears === 0`. Add `placeholder="0"`.

### 6. Opponent — placeholder "–"
**Line 722**: Add `placeholder="–"` to Opponent InputCard.

### 7. Network — placeholder "–"
**Line 733**: Add `placeholder="–"` to Network InputCard.

### 8. Location — placeholder "–"
**Line 735**: Add `placeholder="–"` to Location InputCard.

### Changes to `InputCard` component (lines 35–79)
Add `placeholder?: string` prop. Apply to both `<input>` and `<textarea>` elements with class `placeholder:text-on-surface/40`.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

