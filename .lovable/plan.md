

## Identity Section — Input Formatting, Preview Fixes, Editor & Card Polish

A comprehensive UX pass across five files touching input formatting, preview accuracy, editor tweaks, profile strength recalibration, and card enhancements.

---

### 1. Input Formatting — `IdentityForm.tsx`

**Class Year** → Replace `InputCard` with `SelectCard`, options: 2024–2030.

**Height** → Custom input component. Store raw inches as number string (e.g. `"74"`). Display formatted as `6'2"`. On input, accept only digits; on blur/display, convert: `feet = Math.floor(n/12)`, `inches = n%12`, render `{feet}'{inches}"`. Store the formatted string in the store for preview compatibility.

**Weight** → Numeric-only input. Strip non-digits on input. Display with ` lbs` suffix appended visually (not editable). Store raw number string, preview appends "lbs".

**Vertical, Wingspan, Hand Size** → Numeric-only input. Display with `"` suffix appended visually. Store raw number string, preview appends the symbol.

**Upcoming Game Date** → Replace text input with a date picker using a native `<input type="date">` styled in the existing InputCard wrapper. Format display in preview as `"Sep 1, 2026"` using `Intl.DateTimeFormat`.

**Upcoming Game Time** → Split into two elements: a numeric time input (e.g. `"7:00"`) and an AM/PM toggle button group (two pill buttons styled like position chips). Store combined as `"7:00 PM"` in the store.

---

### 2. Preview Fixes — `IdentityPreview.tsx`

**Star rating** → Fix: unfilled stars need a different color. Currently all render `"star"` icon — filled stars get `var(--team-color)`, unfilled need explicit `text-on-surface-variant/30` color instead of inheriting.

**Upcoming game date** → Parse the ISO date string and format via `new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })` → `"Sep 1, 2026"`.

**Redshirt Status** → Always show in Eligibility block (remove the `!== "None"` conditional). When "None", display the value as-is.

**Hometown + High School** → If both exist and are identical, show only hometown. If different, show as two labeled lines:
```
Hometown: Athens, GA
High School: Cedar Shoals HS
```

---

### 3. Editor Fixes — `SideNav.tsx`, `IdentityForm.tsx`, `athleteStore.ts`

**SideNav header** → Change `"Athlete Profile"` to `"Brand HQ"`.

**Commitment Status** → Replace `SelectCard` dropdown with a button group (three pills: Committed / Uncommitted / In Portal) styled identically to the position selector chips.

**Bio default** → In `athleteStore.ts`, change `bio` default from the placeholder string to `""`. Remove the default bio text entirely.

**Profile Strength recalibration** → Add a computed `profileStrength` derived getter (or compute in SideNav). New weights:
- `actionPhotoUrl`: 25%
- `schoolLogoUrl`: 15%
- `bio` (length > 0): 15%
- `firstName` + `lastName` (both non-empty): 10%
- `position` (non-empty): 10%
- `school` (non-empty): 10%
- `teamColor !== "#00e639"` (changed from default): 5%
- `classYear` (non-empty): 5%
- `number` (non-empty): 3%
- `socialLinks` (1+): 2% — currently not in store, so this stays at 0 until added

Total possible: 100%. SideNav reads these values and computes the percentage + filled segments dynamically instead of hardcoded `84%`.

---

### 4. Card Fixes — `ProCard.tsx`

**Glow intensity** → Replace `.team-glow` class with inline style: `boxShadow: '0 0 60px ${teamColor}55, 0 0 120px ${teamColor}22'` using the store's `teamColor` value.

**Jersey number** → Add jersey `#` as a small element next to the position badge. Format: `#{number}` in a matching pill style, same row as position and class year badges. Only render when `number` is non-empty.

**40-YD on card** → Currently hardcoded as `"4.42"`. Change to read `fortyTime` from the store.

---

### Files modified
- `src/store/athleteStore.ts` — blank bio default
- `src/features/builder/components/IdentityForm.tsx` — input formatting, commitment pills, class year dropdown, time split
- `src/features/builder/components/IdentityPreview.tsx` — star fix, date format, redshirt always shown, hometown/HS logic
- `src/features/builder/components/ProCard.tsx` — glow intensity, jersey number badge, fortyTime from store
- `src/features/builder/components/SideNav.tsx` — "Brand HQ" header, dynamic profile strength

