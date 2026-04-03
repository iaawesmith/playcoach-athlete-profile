

## Five Fixes for Identity Builder

### 1. School banner placeholder text visibility (ProCard.tsx)
Line 77: The empty-state text `text-white/40` on the default teal `#50C4CA` banner is hard to read. Change to `text-white/70` so the placeholder is visible against any team color.

### 2. Clear default height value (athleteStore.ts)
Height is already `""` in defaults — confirmed clean. The issue is the `HeightInputCard` shows `""` which is correct. No store change needed. However, if the user is seeing a non-empty height, it may be residual state from a previous session. The store defaults are correct.

### 3. Time input AM/PM toggle fix (IdentityForm.tsx)
The `TimeInputCard` (lines 252–295) has a problem: when `game.time` is empty, `timePeriod` defaults to `"PM"` silently (line 481), and clicking AM/PM sets the period even when `timeValue` is empty, producing strings like `" AM"`. Fix: make both AM/PM buttons always visible (they already are), but don't auto-set a period until the user clicks one. Change the default period to `""` and only concatenate when both time and period exist.

### 4. TopNav placeholder name (TopNav.tsx)
Line 13: When `firstName` and `lastName` are both empty, show "Your Name" in muted text instead of a blank space.

### 5. Team Color field shows "(Default)" when #50C4CA (IdentityForm.tsx)
Line 571: Update the Team Color (Hex) `InputCard` label to conditionally append "(Default)" when the value is `#50C4CA`.

### Changes by file

**`src/features/builder/components/ProCard.tsx`**
- Line 77: Change `text-white/40` → `text-white/70` for school banner placeholder

**`src/features/builder/components/TopNav.tsx`**
- Line 13: Wrap name span in conditional — if no name, show "Your Name" at `text-on-surface/40`

**`src/features/builder/components/IdentityForm.tsx`**
- Line 481: Default `timePeriod` to `""` instead of `"PM"`
- Lines 483–488: Only concatenate period when period is non-empty; only set period when clicked
- Line 571: Change label from `"Team Color (Hex)"` to conditionally show `"Team Color (Hex) (Default)"` when value is `#50C4CA`

### Files modified
- `src/features/builder/components/ProCard.tsx`
- `src/features/builder/components/TopNav.tsx`
- `src/features/builder/components/IdentityForm.tsx`

