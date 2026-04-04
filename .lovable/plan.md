

## Pull Athlete Photos and School Logo via Firecrawl

### What This Does
Extends the Auto-Fill scraping pipeline to extract three images:
1. **Profile headshot** — from ESPN or school roster page
2. **Action photo** — from ESPN or recruiting profile (game action shots)
3. **School logo** — from the school's athletics website

### How It Works

Firecrawl can return page screenshots and raw HTML containing image URLs. We'll use two approaches:

**For athlete photos**: Scrape the athlete's ESPN or school roster page and extract `<img>` tags that match known patterns (headshot containers, roster photo classes). ESPN uses predictable image URL patterns like `a.espncdn.com/combiner/i?img=...&w=350&h=254`.

**For school logos**: Use Firecrawl's `branding` format on the school athletics site (e.g. `boisestatebroncos.com`) to extract the official logo URL automatically.

### Architecture

```text
ScrapeFill button
  ↓
firecrawl-profile edge function (expanded)
  ├── existing text search (measurables, stats)
  ├── NEW: scrape ESPN profile URL → extract headshot + action img URLs
  └── NEW: scrape school athletics site with branding format → logo URL
  ↓
Returns imageUrls: { headshot?, actionPhoto?, schoolLogo? }
  ↓
ScrapeFill review panel shows image previews with checkboxes
  ↓
On Apply → downloads images → uploads to Supabase Storage → sets store URLs
```

### Changes

**1. Create a storage bucket** for athlete media (migration)
- `athlete-media` bucket, public, with insert/select RLS for authenticated users

**2. `supabase/functions/firecrawl-profile/index.ts`**
- After the text search, if an ESPN or roster URL was found in `sources`, do a targeted scrape of that URL with `formats: ["html"]`
- Parse `<img>` tags from the HTML to find headshot and action photo URLs using known CSS class / URL patterns (ESPN: `.headshot img`, roster: `.player-photo img`)
- If `school` is provided, do a branding scrape of the school athletics domain to get the logo
- Return new fields: `imageUrls: { headshot?, actionPhoto?, schoolLogo? }`

**3. `src/services/firecrawl.ts`**
- Add `imageUrls` to `AthleteProfileData` type

**4. `src/features/builder/components/ScrapeFill.tsx`**
- Render image previews in the results panel (small thumbnails with checkboxes)
- On "Apply Selected", download each selected image via a new edge function, upload to `athlete-media` bucket, and set the resulting public URL on the store (`actionPhotoUrl`, `profilePictureUrl`, `schoolLogoUrl`)

**5. New edge function: `supabase/functions/image-proxy/index.ts`**
- Accepts an external image URL, downloads it, resizes/optimizes (using sharp or canvas if available, otherwise raw passthrough), and uploads to the `athlete-media` storage bucket
- Returns the public URL
- This avoids CORS issues with downloading external images from the browser

### Limitations & Considerations
- ESPN and school sites change their HTML structure — regex/selector extraction is best-effort
- Not all athletes will have photos available on these sites
- Image quality varies — action photos from ESPN are typically low-res thumbnails; full-res may require additional scraping of the image detail page
- Firecrawl credits: each additional scrape costs 1 credit (branding scrape + HTML scrape = 2 extra credits per Auto-Fill)

### Files Created
- `supabase/functions/image-proxy/index.ts`
- Migration for `athlete-media` storage bucket

### Files Modified
- `supabase/functions/firecrawl-profile/index.ts` — image extraction logic
- `src/services/firecrawl.ts` — expanded types
- `src/features/builder/components/ScrapeFill.tsx` — image preview UI + upload flow

