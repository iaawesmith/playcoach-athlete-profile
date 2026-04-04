

## Use SportsLogos.net as Primary Logo Source

### What Changes
Replace the current unreliable branding-extraction approach with a targeted search on sportslogos.net. The site has a consistent structure: each team page lists logo images hosted at `content.sportslogos.net/logos/...`. By searching `site:sportslogos.net {school} logo` via Firecrawl, then scraping the resulting page for markdown, we can reliably extract the primary logo image URL.

### How It Works

**New Strategy 1 (Primary)**: Search sportslogos.net directly
- Firecrawl search query: `site:sportslogos.net {school} logo`
- Scrape the top result with `formats: ["markdown"]`
- Parse markdown for the first image URL matching `content.sportslogos.net/logos/` — these are the actual logo images (`.gif` or `.png`)
- Use the full-size version by replacing `/thumbs/` with `/full/` in the URL path (or use the thumb directly — they're clean vector-style images)

**Existing strategies demoted to fallbacks**: The current branding-extraction and "logo png transparent" searches become Strategy 2 and Strategy 3, only tried if sportslogos.net yields nothing.

### Changes

**`supabase/functions/firecrawl-school-logo/index.ts`**
- Add new Strategy 1: search `site:sportslogos.net {school} logo`, scrape top result as markdown, regex-extract first `content.sportslogos.net/logos/` image URL
- Demote current Strategy 1 (branding extraction) to Strategy 2
- Demote current Strategy 2 (fallback search) to Strategy 3

**`supabase/functions/firecrawl-profile/index.ts`** (lines 364-458)
- Apply the same sportslogos.net-first approach to the school logo search block within the profile scraper
- Same pattern: search site:sportslogos.net, scrape markdown, extract `content.sportslogos.net` image URL
- Keep existing branding strategies as fallbacks

### Files Modified
- `supabase/functions/firecrawl-school-logo/index.ts`
- `supabase/functions/firecrawl-profile/index.ts`

