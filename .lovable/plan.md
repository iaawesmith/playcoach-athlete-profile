

## Session 2 — Live Card Wiring

Wire Zustand store to IdentityForm inputs and ProCard so every keystroke updates the card in real time.

### 1. Expand `athleteStore.ts`

Split `name` into `firstName` and `lastName`. Add new fields:

- `firstName: string` (default "Marcus")
- `lastName: string` (default "Sterling")
- `bio: string`
- `hometown: string`
- `height: string`
- `weight: string`
- `actionPhotoUrl: string | null` (default null)
- `schoolLogoUrl: string | null` (default null)

Remove the old `name` field. Update `setAthlete` type accordingly. Keep `position`, `number`, `school`, `classYear`, `teamColor`, `profileStatus`, `hasBeenPublished` as-is.

### 2. Wire `IdentityForm.tsx` — Live Inputs

- Import `useAthleteStore` and read all fields
- Replace `InputCard` with a controlled version: accept `onChange` callback, use `value` instead of `defaultValue`, remove `readOnly`
- Each input calls `setAthlete({ fieldName: newValue })` on every keystroke via `onChange`
- Position chips become clickable — clicking one calls `setAthlete({ position: pos })`
- School Color input calls `setAthlete({ teamColor: newValue })` and the swatch reads from store
- **Photo upload slot**: wrap in a hidden `<input type="file" accept="image/*">`. On file select, create an object URL via `URL.createObjectURL()` and call `setAthlete({ actionPhotoUrl: url })`. Show thumbnail preview when set.
- **Logo upload slot**: same pattern for `schoolLogoUrl`
- Bottom CTAs: "Discard Changes" resets store to defaults. "Save Identity" is visual-only for now (no persistence until Session 3).

### 3. Wire `ProCard.tsx` — Read From Store

Replace all hardcoded values with store reads:

- `firstName` / `lastName` → two name lines (already two `<h3>` elements)
- `position` → position badge text (map abbreviation to full name, e.g. "WR" → "Wide Receiver")
- `classYear` → class year badge ("Class of {classYear}")
- `school` → school banner text
- `teamColor` → already using `var(--team-color)`, no change needed in card
- `actionPhotoUrl` → when non-null, render `<img>` covering the photo area and hide the "Add Your Action Photo" placeholder
- `schoolLogoUrl` → when non-null, render `<img>` in the bottom-right logo slot at 40% opacity, replacing `ShieldPlaceholder`

### 4. Wire `BuilderLayout.tsx` — Dynamic `--team-color`

Read `teamColor` from store and set it as the CSS variable on the root div instead of hardcoded `#00e639`. This makes the glow, banner, badges, and all accent elements update live.

### Position Label Map (helper in ProCard)

```text
QB → Quarterback    RB → Running Back    FB → Fullback
WR → Wide Receiver  TE → Tight End       OL → Offensive Line
DL → Defensive Line LB → Linebacker      CB → Cornerback
S  → Safety         K  → Kicker          P  → Punter
LS → Long Snapper
```

### Files Modified
- `src/store/athleteStore.ts`
- `src/features/builder/components/IdentityForm.tsx`
- `src/features/builder/components/ProCard.tsx`
- `src/features/builder/BuilderLayout.tsx`

