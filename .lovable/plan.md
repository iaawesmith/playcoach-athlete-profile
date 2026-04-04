

## Fix: Action Photos Not Returning

### Root Cause
The Google Images scrape (Pipeline 2, lines 306-438) is failing silently. Google blocks or CAPTCHAs Firecrawl's scraper, so the HTML returned contains no extractable `<img>` tags with real image URLs. `candidateUrls` stays empty, so no action photos are returned.

### Solution
Replace the Google Images scrape with a two-step approach that uses Firecrawl's reliable `search` endpoint:

1. **Firecrawl search** with an image-focused query like `"Devon Dampier #4 QB Utah Utes football game photo"` targeting image-heavy sites (Getty, AP, school athletics photo galleries, sports news). Limit to 5 results.

2. **Direct scrape top 3 result URLs** using Firecrawl's `scrape` endpoint with `formats: ["html"]`. These are actual article/gallery pages that Firecrawl can render — not Google's anti-bot pages. Extract `<img>` tags from the rendered HTML.

3. **Filter candidates** — skip tiny images, logos, icons. Pre-sort by name relevance.

4. **Gemini Vision verification** — send candidates to AI for verification (existing code, works fine when it has candidates).

5. **HEAD/GET validation** — existing code, works fine.

This replaces lines 305-438 in the edge function. The rest of the pipeline (headshot, school logo, validation) stays unchanged.

### Technical Detail

```text
Current (broken):
  Firecrawl scrape Google Images URL → blocked HTML → 0 candidates

New:
  Firecrawl search "name school football game photo" (5 results) →
  Firecrawl scrape top 3 URLs (rendered HTML) →
  extract <img> from HTML → filter → vision AI → validate
```

The key difference: Firecrawl `search` returns real web results reliably. Firecrawl `scrape` on article/gallery pages works because those sites don't block scrapers like Google does. This is 3-4 Firecrawl credits per profile but produces actual image candidates.

### Files Modified
- `supabase/functions/firecrawl-profile/index.ts`

