

## Six Fixes for Identity Builder

### 1. Go Live button — use #00E639 instead of kinetic-gradient
**`src/features/builder/BuilderLayout.tsx` line 58**: Replace `kinetic-gradient` with `bg-[#00E639]` so the icon button matches the progress bar color exactly. The icon text color stays `text-[#00460a]`.

### 2. Consistent green — audit all non-teamColor greens
Ensure any UI accent green (progress bar segments, live dot, live label, published check icon) all use `#00E639` / `bg-primary-container` / `text-primary` consistently. These already map to `#00e639` in the Tailwind config, so they should be fine. The go-live button is the only outlier using `kinetic-gradient` (a gradient) instead of the flat token.

### 3. Eligibility Remaining — default to 0, display empty
**`src/store/athleteStore.ts` line 75**: Already `0`. The issue is **line 720 in IdentityForm** displays `String(eligibilityYears)` which shows `"0"`. Change to show empty string when `0` so the field appears blank, and treat empty input as `0` internally.

### 4. Transfer Eligible — replace toggle with dropdown (blank/Yes/No)
**`src/features/builder/components/IdentityForm.tsx` lines 724–728**: Replace `ToggleCard` with `SelectCard` using options `[{value:"", label:"Select..."}, {value:"yes", label:"Yes"}, {value:"no", label:"No"}]`. Update store type from `boolean` to `string` (`"" | "yes" | "no"`) with default `""`.

**`src/store/athleteStore.ts`**: Change `transferEligible` type from `boolean` to `string`, default `""`.

### 5. Time field — fix PM default and show both AM/PM buttons
**`src/features/builder/components/IdentityForm.tsx`**: The `timePeriod` regex on line 481 returns `""` when empty (already fixed). The bug is the `handleTimeChange` function on line 483 — when `timePeriod` is empty and user types a number, it stores just the number without a period. Then the display shows the raw value. Fix: ensure both AM/PM buttons are always visible and clickable (they are), but also make sure the placeholder shows `"0:00"` so user knows to type there. The "P PM" issue suggests residual state — the `timeValue` regex captures a stray `P`. Add `placeholder="0:00"` to the time input field (line 274).

### 6. Height — show dashes as placeholder instead of numbers
**`src/features/builder/components/IdentityForm.tsx` lines 146–154**: Change the `placeholder` from `"6"` to `"–"` (en-dash) for feet, and from `"2"` to `"–"` for inches. This makes it clear the fields are clickable/editable without suggesting default values.

### Files modified
- `src/features/builder/BuilderLayout.tsx`
- `src/features/builder/components/IdentityForm.tsx`
- `src/store/athleteStore.ts`

