

## Wire TopNav Name to Zustand Store

Line 10 of `src/features/builder/components/TopNav.tsx` has the name hardcoded as `"Marcus Sterling"`. Import `useAthleteStore` and read `firstName` + `lastName` to display the name dynamically.

### Change

**`src/features/builder/components/TopNav.tsx`**
- Import `useAthleteStore` from `@/store/athleteStore`
- Read `firstName` and `lastName` from the store
- Replace the hardcoded `"Marcus Sterling"` with `{firstName} {lastName}`

### Files modified
- `src/features/builder/components/TopNav.tsx`

