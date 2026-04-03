

## Make Measurable Inputs More Intuitive

The current `NumericInputCard` renders an empty invisible input with just a suffix character ("s", `"`). Users see a near-blank card with no indication where to click or what to enter. The screenshot confirms — "40 TIME" shows just an "s" floating in space.

### Approach — Placeholder + Tap Target Hint

Add a **placeholder value** inside each numeric input that communicates the expected format, plus a subtle visual cue that the field is interactive.

**Changes to `NumericInputCard` (lines 81–110 in IdentityForm.tsx):**

1. Add a `placeholder` prop with a format hint for each measurable:
   - 40 Time → `"4.40"`
   - Vertical → `"36.5"`
   - Wingspan → `"76.0"`
   - Hand Size → `"9.5"`
   - Weight → `"195"`

2. Style the placeholder at 40% opacity (`placeholder:text-on-surface/40`) so it reads as a prompt, not real data — consistent with the existing placeholder convention.

3. When the field is empty, show a faint dashed bottom border (`border-b border-dashed border-outline-variant/30`) on the input area to hint "this is an editable field." The border disappears once a value is entered or the field is focused.

4. Add `cursor-text` to the entire card container so hovering anywhere signals interactivity.

**Changes to `HeightInputCard` (lines 112–160):**
- Already has `placeholder="–"` — update to `"6"` for feet and `"2"` for inches (typical values) at 40% opacity, matching the numeric cards. Add the same dashed bottom border hint.

**Measurable field placeholder map (passed at usage sites, lines 589–605):**
```
Height:    feet="6"  inches="2"
Weight:    "195"
40 Time:   "4.40"
Vertical:  "36.5"
Wingspan:  "76.0"
Hand Size: "9.5"
```

This gives every empty measurable a ghost of what valid data looks like — format, scale, and decimal precision — while the dashed underline draws the eye to the input zone.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

