

## Replace Action Photo Search with Gemini AI Web Search

### What Changes

Replace the entire Firecrawl-based action photo pipeline (search articles → scrape HTML → extract `<img>` tags) with a single Gemini AI call that uses tool calling to search the web and return action photo URLs directly.

### How It Works

**`supabase/functions/firecrawl-profile/index.ts`** — Replace Pipeline 2 (lines 314-513):

1. **Single Gemini call with Google Search grounding**: Ask Gemini to find action photos of the athlete using its built-in web search capability. The prompt includes the athlete's name, school, position, jersey number, and asks specifically for high-resolution game action photo URLs.

2. **Structured output via tool calling**: Use the Lovable AI gateway's tool calling feature to get a clean JSON array of image URLs back — no regex parsing of markdown or HTML needed.

3. **Prompt design**:
```
Find 5-10 high-resolution game action photos of [Name], 
#[Number] [Position] for [School] football. 
Return only direct image URLs (ending in .jpg, .jpeg, .png, .webp) 
from sports photography sites, news outlets, or school athletics. 
Exclude headshots, logos, and non-football images.
```

4. **Validate returned URLs**: Run HEAD/GET requests on the URLs Gemini returns to confirm they're accessible (existing validation logic, reused).

5. **Vision verification (existing)**: Optionally send the validated URLs through the existing Gemini Vision check to confirm they show the correct player in football action. This serves as a second pass.

6. **Fallback**: If Gemini returns no results or the call fails, the function continues without action photos (graceful degradation, same as current behavior).

### What Gets Removed
- Firecrawl text search for action photos (the `photoQuery` search call)
- Firecrawl scrape of top 3 article URLs for HTML extraction
- All `<img>` and `data-src` regex parsing from article HTML
- The `isTinyImage` utility (no longer needed — Gemini returns actual photo URLs, not page assets)
- Pre-sorting by name tokens (Gemini handles relevance)

### What Stays
- Pipeline 1: Roster headshot scrape (working correctly)
- Pipeline 3: ESPN school logo lookup (working correctly)
- Vision verification step (reused as quality check)
- HEAD/GET URL validation (reused)

### Files Modified
- `supabase/functions/firecrawl-profile/index.ts`

