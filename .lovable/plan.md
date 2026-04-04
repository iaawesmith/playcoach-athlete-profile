

## Fix Profile Photo + Action Photo Search

### Two Problems

1. **Profile photo**: Roster page scrape returns multiple headshots (all players on the page). These get mixed into action photo candidates. The athlete's own roster headshot should be extracted as a single profile photo (`imageUrls.headshot`), not dumped into action candidates.

2. **Action photos**: Firecrawl text search returns articles, not images. Even with direct scraping, the images embedded in articles are thumbnails, ads, or other players. The approach is fundamentally wrong for finding action photos.

### Solution

#### 1. Roster Headshot → Profile Photo (single image)

In the roster page scrape section, after scraping the player's individual roster URL:
- Look for images in the markdown/HTML that are near the athlete's name
- Pick the first large image from the player's individual roster page (these are always the player headshot)
- Set it as `imageUrls.headshot` — one image, done
- Do NOT add roster page images to `candidateUrls` for action photos

#### 2. Action Photos via Google Images Scrape

Replace the current Firecrawl text-search-based image extraction with a direct scrape of Google Images:
- Use Firecrawl's `scrape` endpoint on `https://www.google.com/search?q=Devon+Dampier+Utah+Utes+QB+action+photo&tbm=isch` (Google Images URL)
- Extract image URLs from the HTML response (`<img>` tags with `data-src` or `src` attributes pointing to actual image CDNs)
- Send extracted candidates to Gemini Vision for verification (existing logic)
- This mirrors what the user would see doing a manual Google Images search

#### 3. Separation of Concerns

The current code mixes all image sources together. Restructure into three isolated pipelines:
- **Headshot pipeline**: roster page → single headshot → `imageUrls.headshot`
- **Action photo pipeline**: Google Images scrape → Gemini vision filter → `actionPhotoCandidates`
- **School logo pipeline**: ESPN CDN lookup (unchanged)

### Technical Detail

**`supabase/functions/firecrawl-profile/index.ts`** changes:

**Headshot extraction** (~line 380-390): When processing scraped roster pages, isolate the player's headshot. Roster pages typically have one large image per player page. Extract it, set `imageUrls.headshot`, and skip adding roster images to `candidateUrls`.

**Action photo search** (~line 249-480): Replace the two Firecrawl text searches (`identityQuery` + `photoQuery`) and the direct-scrape-for-images logic with:
```
1. Build Google Images URL:
   google.com/search?q={name}+{school}+{position}+football+action+photo&tbm=isch

2. Firecrawl scrape that URL with formats: ["html"]

3. Extract image URLs from Google's HTML (data-src, data-iurl, or src on img tags)

4. Filter out tiny/utility images

5. Send to Gemini Vision for verification (existing code)

6. Validate with HEAD requests (existing code)
```

This eliminates ~4 unnecessary Firecrawl search/scrape calls and replaces them with 1 targeted scrape of Google Images.

### Files Modified
- `supabase/functions/firecrawl-profile/index.ts`

