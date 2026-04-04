

## Fix ESPN Logo Lookup Not Matching "Brigham Young Cougars"

### Problem
The `lookupSchoolLogo` function matches aliases with exact equality only (`n.toLowerCase() === q`). The profile scraper sends `school = "Brigham Young Cougars"` but the dataset alias is `"Brigham Young"` — no exact match. The `includes` checks only apply to the `s` field ("BYU"), not aliases.

### Fix

**`supabase/functions/_shared/espnLogos.ts`** — Expand the matching logic to also check substring containment on aliases:
```
s.n.some(n => n.toLowerCase() === q || q.includes(n.toLowerCase()) || n.toLowerCase().includes(q))
```

This way "brigham young cougars".includes("brigham young") → true → match found → returns ESPN CDN URL.

Also add the same improved matching to `src/data/schoolLogos.ts` for client-side consistency.

**Redeploy** both `firecrawl-profile` and `firecrawl-school-logo` edge functions (they import from `_shared/espnLogos.ts`).

### Files Modified
- `supabase/functions/_shared/espnLogos.ts`
- `src/data/schoolLogos.ts`

