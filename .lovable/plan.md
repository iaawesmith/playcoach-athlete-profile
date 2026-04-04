

## Fix ProfilePreview: Remove Completion Section and Fix Card Data

### Problem
1. The profile completion percentage and segmented bar (lines 163–180) should be removed — completion will be shown inside the builder instead.
2. The mini ProCard school banner shows `schoolAbbrev` first (line 138), but should show the full school name like the real ProCard does.
3. The card isn't reading `classYear` from the store, so class year doesn't appear. Jersey number and position are read but may not display if the store fields use different names — `number` is correct per the store, and `position` is correct. The issue is that `classYear` is destructured on line 75 but never rendered in the card.

### Changes to `src/features/onboarding/steps/ProfilePreview.tsx`

1. **Remove the completion section** (lines 163–180): Delete the animated percentage, segmented bar, and "Profile completion" label entirely. Also remove the `computeCompletion` function and `AnimatedPct` component since they become unused.

2. **Fix school banner text**: Change line 138 from `{schoolAbbrev || school || "SCHOOL"}` to `{school || schoolAbbrev || "SCHOOL"}` — prefer full school name.

3. **Add classYear to the card info**: On line 156–158, update the position/number line to also show class year:
   ```
   {position || "POS"} {number ? `#${number}` : ""} {classYear ? `· ${classYear}` : ""}
   ```

4. **Destructure classYear**: Already destructured on line 75 — no change needed there.

5. **Clean up unused code**: Remove `computeCompletion` function (lines 21–42), `AnimatedPct` component (lines 44–69), and the `completionPct` variable (line 101).

### Files Modified
- `src/features/onboarding/steps/ProfilePreview.tsx`

