

## Add University Autocomplete to Opponent Field

### What changes

Replace the plain `InputCard` for "Opponent" in the Upcoming Game section with the same university autocomplete search used for the School field. When the athlete types, it filters the university list and shows a dropdown. Selecting a university fills in the opponent name.

### Changes in `src/features/builder/components/IdentityForm.tsx`

**1. Extract a reusable `UniversityAutocomplete` component** from the existing `SchoolSearchCard` (lines 265–393). The new component will accept a generic `label`, `value`, `onSelect` (returns university name string), and `placeholder` prop. The existing School field and the new Opponent field will both use it.

Alternatively, since the Opponent field only needs the university name (no abbreviation/color side effects), create a simpler variant: a `UniversitySearchCard` that takes `label`, `value`, `onChange` (string), and `placeholder`. Internally it reuses the same filtering logic against the `universities` array.

**2. Replace the Opponent `InputCard`** (line 745) with:
```
<UniversitySearchCard
  label="Opponent"
  value={game.opponent}
  onChange={(name) => setGame("opponent", name)}
  placeholder="Search schools..."
/>
```

The dropdown will show the same styled list (color dot, name, abbreviation) but on select it simply sets the opponent string to the university name.

**3. Keep SchoolSearchCard as-is** for the School field since it has extra side effects (setting abbreviation, teamColor, etc.).

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

