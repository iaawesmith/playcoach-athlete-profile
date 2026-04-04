

## Use Onboarding Data to Improve Scrape Accuracy

### Problem
The `fetchAthleteProfile` call only sends `name` and `school`. The edge function then guesses position, jersey number, and class year from scraped markdown — often incorrectly. The athlete already provided position, jersey, and class during onboarding, but none of that is used.

### Solution
Pass all known fields to the edge function and use them in two ways:
1. **Better search queries** — include position in the search query (e.g., "Bear Bachmeier QB Boise State") for more relevant results
2. **Known-field priority** — if the athlete already set a field (position, jersey, class), don't overwrite it with scraped data. Only return fields the athlete hasn't filled in yet.

### Changes

**`src/services/firecrawl.ts`** — expand `fetchAthleteProfile` signature:
```typescript
async fetchAthleteProfile(
  name: string,
  school?: string,
  knownFields?: { position?: string; number?: string; classYear?: string }
): Promise<ProfileResponse>
```
Pass `knownFields` in the request body.

**`supabase/functions/firecrawl-profile/index.ts`** — two changes:
1. Include position in the search query when provided: `"Bear Bachmeier QB Boise State football"` instead of just `"Bear Bachmeier Boise State football"`
2. After extraction, remove any fields that match keys in `knownFields` (if the athlete already entered position as QB, don't return a scraped position at all)

**`src/features/builder/components/ScrapeFill.tsx`** — pass known fields from the store:
```typescript
const { position, number, classYear } = useAthleteStore();
const result = await firecrawlApi.fetchAthleteProfile(
  fullName,
  school || undefined,
  { position, number, classYear }
);
```

### Result
- Search results will be more targeted (adding "QB" to the query surfaces QB-specific profiles)
- Position, jersey, and class won't be overwritten by wrong scraped data
- Only truly new data (height, weight, 40 time, hometown, high school, star rating, etc.) gets offered to the athlete

### Files modified
- `src/services/firecrawl.ts` — expanded function signature
- `supabase/functions/firecrawl-profile/index.ts` — use position in query, skip known fields
- `src/features/builder/components/ScrapeFill.tsx` — pass known fields from store
