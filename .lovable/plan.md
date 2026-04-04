

## Show School Logo in Auto-Populate Results

### Problem
The `firecrawl-profile` edge function attempts to find a school logo via a single branding search (lines 365-399), but it frequently fails — as confirmed by a live test with "Bear Bachmeier / BYU" returning no `schoolLogo` in `imageUrls`. Meanwhile, a dedicated `firecrawl-school-logo` edge function exists with a more robust two-strategy approach (branding + fallback image search) that works better.

Because `imageUrls.schoolLogo` is empty, it never appears in the "Photos" grid on the onboarding preview page.

### Fix

**`supabase/functions/firecrawl-profile/index.ts`** — Replace the current school logo search (lines 364-399) with the same two-strategy logic from `firecrawl-school-logo`:

1. **Strategy 1**: Search for `{school} athletics official logo`, scrape top result with `branding` format, extract `logo` or `favicon` from branding data
2. **Strategy 2 (fallback)**: Search for `{school} logo png transparent`, scrape top 2 results for branding, extract logo
3. **Strategy 3 (fallback)**: Search markdown results for image URLs containing "logo" in the path — pick the first matching `.png` or `.svg`

This ensures the school logo reliably appears alongside the action photo and headshot in the auto-populate results grid.

### Files Modified
- `supabase/functions/firecrawl-profile/index.ts`

