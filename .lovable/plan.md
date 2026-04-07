

## Plan: Populate ProCard RATING with 247 Composite Rating

### What's happening now
- The ProCard shows `ratingComposite` for the RATING field
- `ratingComposite` only gets populated from CFBD recruiting data (line 294 in useAutoFill.ts)
- `compositeRating247` gets populated from 247Sports scraping but is stored in a separate field and never shown on the card

### Fix — ProCard.tsx only

Update the RATING value in the `physicals` array to prefer `compositeRating247` over `ratingComposite`:

```typescript
// Add compositeRating247 to the destructured store values
const { ..., compositeRating247 } = useAthleteStore();

// In physicals array, prefer 247 composite rating
{ label: "RATING", value: compositeRating247 
    ? compositeRating247.toFixed(4) 
    : ratingComposite || "—" }
```

This keeps the field label as "RATING" on the card. Priority: `compositeRating247` (from 247Sports) → `ratingComposite` (from CFBD) → "—" (empty).

### Files modified
- `src/features/builder/components/ProCard.tsx` — one change only

