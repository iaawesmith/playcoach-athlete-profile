

## Instant ProCard Preview from Auto-Fill Data

### Problem

The auto-fill pipeline collects data but only writes to the Zustand store after the user reviews and clicks "Apply Selected." The ProCard reads from the store, so it stays empty during the review step. Additionally, CFBD's recruiting `rating` is stored as `recruitingRating` but the ProCard reads `ratingComposite` — so even after apply, the rating never shows.

### Changes

**File: `src/hooks/useAutoFill.ts`**

1. **Immediate preview write** — After enrichment completes (right before building the field entries for review), call `setAthleteFromSource` with a subset of preview-critical fields: `height`, `weight`, `ratingComposite`, `actionPhotoUrl`. This makes the ProCard update instantly while the user is still reviewing the full field list. These writes still respect source protection (won't overwrite manual fields).

2. **Map CFBD rating → ratingComposite** — In Phase 1b (recruiting extraction), when `recruit.rating` is found, write it to both `recruitingRating` (for the Identity form's "Composite Rating" display card) and `ratingComposite` (for the ProCard's "RATING" display). Currently only `recruitingRating` is set, so the ProCard never gets the value.

3. **Map 247 compositeRating → ratingComposite** — In Phase 2 (247Sports extraction), when `d.compositeRating` is found, also write to `ratingComposite` in addition to `recruitingRating`.

**No changes to:** `athleteStore.ts`, `ProCard.tsx`, `IdentityForm.tsx`, or any other files. The ProCard already reads `height`, `weight`, `ratingComposite`, and `actionPhotoUrl` correctly — it just needs the store to be populated.

### Technical detail

The immediate preview write will use a dedicated `setAthleteFromSource` call with the appropriate source tag (e.g. `cfbd`). When the user later clicks "Apply Selected," the full batch write happens as before — but since the preview fields are already set with the same source, it's a no-op for those keys. If the user deselects a field during review, we won't "undo" the preview (acceptable tradeoff for instant feedback).

