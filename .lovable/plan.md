

## Improve Action Photo Search Quality with AI Vision Filtering

### Problem
The current approach searches for web pages via Firecrawl text search, extracts image URLs from markdown content, then asks Gemini to filter based on **URL strings only**. This fails because:
- Firecrawl returns articles, not image results — embedded images are often thumbnails, ads, or unrelated photos
- AI filtering on URL text alone cannot determine if an image actually shows the correct athlete playing football
- Only 5 search results are scraped, limiting the candidate pool
- For a well-known starter like Devon Dampier (Utah QB #4), this produces 1 good photo and random noise (cars, etc.)

### Solution
Two changes to `supabase/functions/firecrawl-profile/index.ts`:

**1. Better search queries targeting image-rich sources**

Replace the single generic photo search with two targeted searches:
- School athletics roster/media page (e.g., "Devon Dampier Utah Utes football") — these pages typically have official action photos
- Sports media search targeting Getty/AP-sourced images (e.g., "Devon Dampier quarterback Utah football action photo") with higher limit (8 results instead of 5)

Also add the jersey number and class year to the search query when available — this disambiguates common names.

**2. Use Gemini vision to verify candidate images**

Instead of asking Gemini to judge images by URL text, send the actual candidate image URLs to a vision-capable model (`google/gemini-2.5-flash`) using the multimodal content format. The prompt instructs the model to:
- Verify each image shows a football player in action (not a car, headshot, logo, or unrelated image)
- Check for matching jersey number and school uniform colors when known
- Return only URLs that are genuine football action photos, ranked by quality

This is the key improvement — visual verification eliminates the random/unrelated images that slip through URL-only filtering.

### Technical Details

**`supabase/functions/firecrawl-profile/index.ts`** — changes to the image extraction section (lines 241-362):

1. **Search query improvement** (line 247): Add jersey number and school abbreviation when available. Use two queries:
   - `"Devon Dampier #4 Utah Utes football"` (identity-focused, limit 4)
   - `"Devon Dampier quarterback Utah action photo game"` (image-focused, limit 6)

2. **Increase candidate extraction**: Merge images from both searches, deduplicate, keep up to 30 candidates

3. **Vision-based AI filtering**: Send up to 12 candidate URLs as `image_url` content parts to Gemini 2.5 Flash. The prompt asks the model to visually verify each image shows a football player in game action, filtering out non-football images (cars, logos, crowds, other sports). The model returns a ranked JSON array of verified URLs.

4. **Fallback**: If vision filtering fails or returns empty, fall back to the existing URL-based filtering logic so the feature degrades gracefully.

### Files Modified
- `supabase/functions/firecrawl-profile/index.ts`

