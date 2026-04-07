

## Fix: 247 Composite Rating Not Populating on ProCard

### Root Cause

The `compositeRating247` value from the 247Sports scrape (Phase 2) is collected into `enrichedFields` for user review but is **never immediately written to the store** like the action photo was. The ProCard reads `compositeRating247` from Zustand, which stays `null` until the user expands the field list and clicks "Apply Selected."

Additionally, CFBD recruiting data writes `ratingComposite` (a string) on line 294, but never writes `compositeRating247` (the number the ProCard prefers).

### Fix — useAutoFill.ts only

**1. Immediately write key rating fields to the store during Firecrawl phase** (same pattern as actionPhotoUrl fix):

After collecting 247 data into `data` (around line 413), immediately push rating fields to the store so the ProCard updates live:

```typescript
// Write 247 rating data to store immediately so ProCard updates live
const immediateRatingFields: Partial<Record<string, unknown>> = {};
if (data.compositeRating247 != null) immediateRatingFields.compositeRating247 = data.compositeRating247;
if (data.compositeStars247 != null) immediateRatingFields.compositeStars247 = data.compositeStars247;
if (data.nationalRank != null) immediateRatingFields.nationalRank = data.nationalRank;
if (data.positionRank != null) immediateRatingFields.positionRank = data.positionRank;
if (data.compositeNationalRank247 != null) immediateRatingFields.compositeNationalRank247 = data.compositeNationalRank247;
if (data.compositePositionRank247 != null) immediateRatingFields.compositePositionRank247 = data.compositePositionRank247;

if (Object.keys(immediateRatingFields).length > 0) {
  setAthleteFromSource(immediateRatingFields, "247");
}
```

**2. Also populate `compositeRating247` from CFBD recruiting** as a fallback (around line 293):

```typescript
if (recruit.rating) {
  cfbdData.ratingComposite = Number(recruit.rating).toFixed(4);
  cfbdData.compositeRating247 = Number(recruit.rating); // fallback for ProCard
}
```

This ensures the rating shows up on the ProCard from CFBD data even if 247 scraping fails.

### Files modified
- `src/hooks/useAutoFill.ts` — two changes: immediate store write for 247 rating fields + CFBD fallback for compositeRating247

