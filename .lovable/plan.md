

## Firecrawl Integration — Full Scraping Pipeline

Firecrawl is now connected. Here's the plan to build a scraping pipeline that auto-populates athlete profile fields from recruiting sites, school pages, and news mentions.

### Architecture

```text
┌─────────────┐      ┌──────────────────────┐      ┌───────────────┐
│  Frontend    │ ───► │  Edge Functions       │ ───► │  Firecrawl    │
│  (scrape UI) │      │  firecrawl-scrape     │      │  API v1       │
│              │      │  firecrawl-search     │      │               │
│              │      │  firecrawl-profile    │      │               │
└─────────────┘      └──────────────────────┘      └───────────────┘
       │                        │
       ▼                        ▼
  athleteStore           AI extraction
  (auto-populate)        (parse fields)
```

### 1. Edge Functions (4 functions)

**`supabase/functions/firecrawl-scrape/index.ts`** — General single-URL scrape. Accepts URL + format options, returns markdown/html/screenshot.

**`supabase/functions/firecrawl-search/index.ts`** — Web search with optional scraping. Used for finding athlete mentions, news articles.

**`supabase/functions/firecrawl-crawl/index.ts`** — Multi-page crawl for school athletics sites (rosters, schedules).

**`supabase/functions/firecrawl-profile/index.ts`** — Smart profile scraper. Accepts athlete name + school, uses Firecrawl search to find 247Sports/Rivals/MaxPreps pages, scrapes them with JSON extraction format to pull structured data (star rating, rankings, measurables, stats, height, weight, 40 time, hometown, high school). Returns a normalized object matching athleteStore fields.

### 2. Frontend API Layer

**`src/services/firecrawl.ts`** — Client-side API wrapper with typed methods:
- `scrape(url, options)` — single URL scrape
- `search(query, options)` — web search
- `crawl(url, options)` — multi-page crawl
- `fetchAthleteProfile(name, school)` — calls the smart profile edge function, returns structured athlete data

### 3. Builder Integration

**`src/features/builder/components/ScrapeFill.tsx`** — A button/panel in the Identity editor that triggers `fetchAthleteProfile()` using the athlete's name + school from the store. Shows a loading state, then presents scraped data for the athlete to review and accept (auto-populates store fields like height, weight, 40 time, star rating, rankings, hometown, high school, bio draft).

Flow:
1. Athlete enters name + school in CoreSetup or Identity
2. Clicks "Auto-Fill from Web" button
3. Edge function searches 247Sports/Rivals for their profile
4. Scrapes the page with JSON extraction schema
5. Returns structured data
6. UI shows preview of found data with checkboxes
7. Athlete confirms which fields to import → `setAthlete()` updates store

### 4. Data Sources & Field Mapping

| Source | Fields Extracted |
|--------|-----------------|
| 247Sports / Rivals | starRating, nationalRank, positionRank, height, weight, hometown, highSchool |
| School athletics site | roster confirmation, jersey number, class year, position, bio |
| News / social search | recent mentions, highlight links |

### Files Created
- `supabase/functions/firecrawl-scrape/index.ts`
- `supabase/functions/firecrawl-search/index.ts`
- `supabase/functions/firecrawl-crawl/index.ts`
- `supabase/functions/firecrawl-profile/index.ts`
- `src/services/firecrawl.ts`
- `src/features/builder/components/ScrapeFill.tsx`

### Files Modified
- `src/features/builder/components/IdentityForm.tsx` — add ScrapeFill button/panel

