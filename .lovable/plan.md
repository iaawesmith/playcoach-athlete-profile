

## Six Small Fixes

### 1. Bio placeholder — `"Your bio..."`
**Line 754**: Add `placeholder="Your bio..."` to the Athlete Bio `InputCard`.

### 2. Personal Quote placeholder — `"Your quote..."`
**Line 757**: Add `placeholder="Your quote..."` to the Personal Quote `InputCard`.

### 3. Hometown placeholder — `"–"`
**Line 759**: Add `placeholder="–"` to Hometown `InputCard`.

### 4. High School placeholder — `"–"`
**Line 760**: Add `placeholder="–"` to High School `InputCard`.

### 5. Time PM button not working
The `handlePeriodChange` (line 458) only sets period when `timeValue` is truthy. But `timeValue` is derived from regex on `game.time` — when time is empty, clicking PM does nothing. Fix: allow period selection even when no time is entered. Remove the `if (timeValue)` guard and store just the period when time is empty, e.g. store `" PM"` or change logic to always set period so the button highlights. Better approach: track period selection regardless of time value — set `setGame("time", timeValue ? \`${timeValue} ${p}\` : \` ${p}\`)` or simply always store it. Then the regex parse on line 451 needs to also match a bare ` PM`/` AM`.

Simpler fix: remove the guard entirely. When `timeValue` is empty, store `p` as a marker. Update regex on line 451 to `game.time.match(/^([\d:]*)\s*(AM|PM)?$/i)` (make digits optional). This way clicking PM on an empty field stores `" PM"`, the regex captures it, and the button highlights. When user types a number, it prepends correctly.

### 6. Height placeholders — change from `"6"` / `"2"` to `"0"` / `"0"` at 40% opacity
**Lines 157, 165**: Change placeholder from `"6"` to `"0"` and from `"2"` to `"0"`. The 40% opacity class `placeholder:text-on-surface/40` is already applied.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

