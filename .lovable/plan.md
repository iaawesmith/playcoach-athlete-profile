

## Expand Firecrawl Profile to Include ESPN and School Roster Sources

Currently the edge function searches only `site:247sports.com OR site:rivals.com OR site:on3.com`. We'll broaden the search to include ESPN and school roster pages, and add regex patterns for the formats those sites use.

### Changes in `supabase/functions/firecrawl-profile/index.ts`

**1. Expand the search query** (around line 41-43)

Add `site:espn.com` and remove the site restriction for one of the search slots so school `.edu` roster pages can surface:

```
const searchQuery = school
  ? `${name} ${school} football roster profile site:247sports.com OR site:rivals.com OR site:on3.com OR site:espn.com`
  : `${name} football recruiting profile site:247sports.com OR site:rivals.com OR site:on3.com OR site:espn.com`;
```

Also increase the search `limit` from 3 to 5 to capture more sources.

**2. Add a second search for school roster pages** — a separate Firecrawl search call:

```
const rosterQuery = school
  ? `${name} ${school} football roster`
  : null;
```

If `school` is provided, run a second search (limit 2) without site restrictions so `.edu` roster pages can appear. Merge results into the same extraction pipeline.

**3. Add regex patterns for ESPN and roster page formats**

ESPN uses patterns like `HT/WT: 6-2, 195 lbs` and school rosters often use table formats like `Ht.: 6-2 | Wt.: 195`. Add:

```typescript
// ESPN-style combined HT/WT
const htwtMatch = content.match(/HT\/WT[:\s]*(\d+['-]\d+)[,\s]+(\d+)\s*lbs/i);
if (htwtMatch) {
  if (!merged.height) merged.height = htwtMatch[1];
  if (!merged.weight) merged.weight = htwtMatch[2];
}

// Roster-style Ht./Wt.
const htMatch2 = content.match(/Ht\.?[:\s]*(\d+['-]\d+)/i);
if (htMatch2 && !merged.height) merged.height = htMatch2[1];

const wtMatch2 = content.match(/Wt\.?[:\s]*(\d+)/i);
if (wtMatch2 && !merged.weight) merged.weight = wtMatch2[1];

// Jersey number from roster
const jerseyMatch = content.match(/#(\d{1,3})\b/);
if (jerseyMatch && !merged.number) merged.number = jerseyMatch[1];
```

**4. Update the loading text in `ScrapeFill.tsx`** (line 138)

Change "Searching 247Sports, Rivals, and On3" to "Searching recruiting sites, ESPN, and school rosters" for accuracy.

### Files modified
- `supabase/functions/firecrawl-profile/index.ts` — broader search query, second roster search, additional regex patterns
- `src/features/builder/components/ScrapeFill.tsx` — updated status text

