

## AI-Powered Action Photo Search

### Problem
Firecrawl's HTML scraping approach for finding athlete photos is unreliable — it parses `<img>` tags with regex and guesses based on CSS class names, which breaks across different site structures.

### Solution
Replace the HTML-scraping image extraction with an AI-driven pipeline:

1. **Dedicated image search** — Use Firecrawl search with a photo-specific query: `"Bear Bachmeier QB BYU Cougars action game photo"`
2. **Collect candidate image URLs** — Extract all image URLs from the top search results' markdown/HTML
3. **AI image selection** — Send the candidate URLs to a Gemini vision model, asking it to pick the best action photo for a portrait-oriented card (aspect 3:4)
4. **Download and persist** — The selected image gets proxied through `image-proxy` to permanent storage

### Architecture

```text
firecrawl-profile edge function
  ├── existing text search (measurables, stats) — unchanged
  └── NEW image pipeline:
       ├── Firecrawl search: "[name] [position] [school] action game photo"
       ├── Collect candidate image URLs from results
       ├── Call Gemini vision: "Which URL is the best action photo?"
       └── Return selected URL as imageUrls.actionPhoto
```

### Changes

**`supabase/functions/firecrawl-profile/index.ts`**
- Replace the current HTML-scraping image logic (lines 241–324) with:
  - A Firecrawl search query specifically for photos: `"[name] [position] [school] action game photo"`
  - Extract image URLs from the search results (from markdown image syntax and HTML img tags)
  - Call the Lovable AI gateway (Gemini Flash) with the list of candidate URLs, asking: "Which of these image URLs is most likely a high-quality action photo of [name] playing football? Pick the one best suited for a 3:4 portrait card. Return only the URL."
  - Use the AI-selected URL as `imageUrls.actionPhoto`
- Keep the school logo branding search as-is (lines 326–361)
- Keep the headshot extraction from ESPN/roster pages but simplify it

**`src/hooks/useAutoFill.ts`** — No changes needed (already handles `imageUrls` from the edge function)

**`src/features/onboarding/steps/ProfilePreview.tsx`** — No changes needed

### Technical Detail
- The Gemini call uses `LOVABLE_API_KEY` (already available as a secret) via the AI gateway endpoint
- Model: `google/gemini-2.5-flash` for speed — it only needs to evaluate a list of URLs and pick one
- If no good candidate is found, the AI returns empty and no action photo is offered
- Firecrawl credit cost: 1 additional search (photo-specific) = 1 extra credit per Auto-Fill

### Files Modified
- `supabase/functions/firecrawl-profile/index.ts` — replace HTML image scraping with AI-powered image search and selection

