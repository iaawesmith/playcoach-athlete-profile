

## Use ESPN CDN Logo Lookup Instead of Firecrawl Scraping

### What Changes
Replace the entire multi-strategy Firecrawl logo scraping (3 API calls, unreliable, hotlink-blocked) with a simple lookup against the GitHub gist CSV data. Every NCAA team maps to a publicly accessible ESPN CDN URL like `http://a.espncdn.com/i/teamlogos/ncaa/500/{id}.png` — no hotlinking issues, instant, zero Firecrawl credits.

The gist also provides dark-mode logo variants (`500-dark/{id}.png`), team colors, abbreviations, and mascots — bonus data we can use.

### How It Works

1. **Embed the logo lookup data** as a static JSON map in the edge function. The gist has ~1,600 schools. We extract just `school → logo URL` pairs (and alt names for fuzzy matching). This is ~50KB — fine for an edge function.

2. **Fuzzy match the school name** the athlete entered against the CSV data using normalized lowercase comparison, checking `school`, `alt_name1`, `alt_name2`, `alt_name3` fields.

3. **Return the ESPN CDN URL directly** — no scraping, no branding extraction, no proxy needed. ESPN CDN serves these logos publicly.

### Changes

**`supabase/functions/firecrawl-profile/index.ts`**
- Replace lines 364-475 (the entire 3-strategy Firecrawl logo search) with a simple lookup function
- Import a static school-logo map (embedded in the function)
- Match school name → return `http://a.espncdn.com/i/teamlogos/ncaa/500/{id}.png`
- If no match found, fall back to a single Firecrawl branding search (Strategy 2 from current code) as last resort

**`supabase/functions/firecrawl-school-logo/index.ts`**
- Same approach: ESPN CDN lookup first, Firecrawl fallback only if not in the dataset

**`src/data/schoolLogos.ts`** (new file)
- Export a lookup map from the gist data for any client-side use (e.g., auto-populating logo when school is selected in onboarding, without waiting for the edge function)

### Benefits
- Instant logo resolution — no API calls needed for NCAA schools
- 100% reliable for any school in the ESPN dataset (~1,600 teams)
- Zero Firecrawl credits consumed for logos
- No hotlinking issues (ESPN CDN is public)
- Dark-mode variants available for future use

### Files Modified
- `supabase/functions/firecrawl-profile/index.ts`
- `supabase/functions/firecrawl-school-logo/index.ts`
- `src/data/schoolLogos.ts` (new)

