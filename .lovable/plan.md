

## Fix: No Action Photos Returned from Firecrawl Search

### Root Cause
Firecrawl's `search` endpoint returns markdown content from web pages. Sports sites (247sports, on3, ESPN, school rosters) load action photos via JavaScript, lazy-loading, or CSS — these don't appear as `![alt](url)` in markdown. So `candidateUrls` ends up empty and no action photo is returned.

### Solution
Add a **direct scrape** of the athlete's school roster page (which we already find in the search results) using Firecrawl's `scrape` endpoint with `formats: ["markdown", "links"]`. Roster pages like `utahutes.com/sports/football/roster/devon-dampier/17509` typically have a player photo. Additionally, scrape the top 2-3 search result URLs directly to get their full rendered markdown (which includes more images than the search preview).

**`supabase/functions/firecrawl-profile/index.ts`** — changes to image extraction section:

1. **Identify high-value URLs from search results** — look for roster pages (school athletics domains) and recruiting profile pages (247sports, on3, rivals) in the `sources` array.

2. **Direct scrape top URLs** — use `https://api.firecrawl.dev/v1/scrape` on up to 3 high-value URLs with `formats: ["markdown"]`. The scrape endpoint renders JavaScript and returns full page content, unlike the search preview which is often truncated.

3. **Also extract `<img>` from HTML** — add `"html"` to scrape formats and parse `<img src="...">` tags in addition to markdown `![](url)` syntax. Many sports sites embed player photos as `<img>` that don't appear in markdown.

4. **Relax the URL filter** — the current regex at line 300 filters out URLs containing "rating" which catches legitimate image CDN URLs. Tighten the filter to only skip truly tiny utility images (favicons, 1x1 pixels, SVGs) rather than broad keyword matching.

5. **Keep existing vision verification + HEAD validation** — these work correctly, the problem is upstream (no candidates to verify).

### Technical Detail

```text
Current flow:
  search (markdown preview) → extract ![](url) → filter → vision AI → validate
  Problem: markdown previews have 0 action photos

New flow:
  search → identify best URLs → scrape those URLs (full render) → 
  extract images from markdown + html → filter → vision AI → validate
```

The key addition is scraping 2-3 URLs directly rather than relying solely on search preview markdown. This costs 2-3 extra Firecrawl credits per profile but dramatically increases the candidate pool.

### Files Modified
- `supabase/functions/firecrawl-profile/index.ts`

