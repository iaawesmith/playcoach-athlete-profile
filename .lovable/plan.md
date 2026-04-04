

## Fix Action Photo Candidates + Preview Height/Weight on Card

### Problem 1: Random athlete photos in candidates
The `actionPhotoCandidates` array contains every image URL found in search results (filtered only by format/size). When cycling, users see photos of other players because the candidates weren't verified as photos of the specific athlete.

**Fix**: Instead of having AI pick just one best URL, have AI filter and rank ALL candidates. Return only URLs that AI confirms are likely photos of the target athlete.

### Problem 2: Height/weight not previewed on card
The ProCard reads `height` and `weight` from the Zustand store, but auto-fill only writes to the store on "Apply". During the results preview, scraped height/weight data shows in the checklist but not on the card.

**Fix**: When results arrive, temporarily set scraped measurables (height, weight) on the store for live preview — same pattern already used for `actionPhotoUrl`. Restore originals on dismiss.

---

### Changes

**`supabase/functions/firecrawl-profile/index.ts`**
- Change the AI prompt from "pick one best URL" to "filter and rank ALL candidates that are likely photos of this specific athlete"
- AI returns a JSON array of URLs it believes show the named athlete, in ranked order
- Only those filtered URLs go into `actionPhotoCandidates`
- First URL in the filtered list becomes `imageUrls.actionPhoto`

**`src/hooks/useAutoFill.ts`**
- On scrape results, temporarily set `height`, `weight`, and other key measurables on the store (alongside `actionPhotoUrl`) for live card preview
- Save original values in a ref to restore on dismiss
- On dismiss, restore all original values (not just `actionPhotoUrl`)

### Files Modified
- `supabase/functions/firecrawl-profile/index.ts`
- `src/hooks/useAutoFill.ts`

