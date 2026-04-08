

## Plan: Add Missing Fields UI to ProfilePreview + Fix Action Photo Discovery

### Problem 1: Missing Fields Not Showing
`ProfilePreview.tsx` (the active component on `/onboarding/preview`) never renders the missing fields section. The missing fields UI exists only in `ScrapeFill.tsx`, which is **never imported or rendered anywhere in the app**. The fix is to add the missing fields panel to `ProfilePreview.tsx`.

### Problem 2: Action Photo Not Found
All three action photo sources failed:
- **247Sports**: Regex requires player name slug in the image URL (`devon-dampier`), but 247's CDN images rarely include player names — they use numeric IDs
- **ESPN**: The `isActionPhoto` filter requires `/photo/` URLs to also contain game-context keywords (`action`, `game`, `play`, `field`, `stadium`), which is too strict. Most ESPN player page photos use `/combiner/` paths which pass, but the regex `(?:src|content)="(https?:\/\/a\.espncdn\.com\/...)` only matches `a.espncdn.com`, missing other ESPN CDN subdomains
- **School roster**: Google scrape for school domain failed to find a matching roster URL

### Changes

**1. `src/features/onboarding/steps/ProfilePreview.tsx`**
- Add missing fields collapsible panel inside the `autoFill.status === "results"` block, below the existing field list and above the Apply/Skip buttons
- Uses same collapsed toggle pattern as "View All Fields"
- Renders `autoFill.missingFields` with field name, reason, and source badge
- Only shows when `autoFill.missingFields.length > 0`
- Add `const [showMissing, setShowMissing] = useState(false)` for toggle state

**2. `supabase/functions/firecrawl-profile/index.ts`** — Fix 247 action photo extraction
- Remove the player-slug requirement from 247 photo matching — instead, look for any large player image on the 247 profile page that isn't a headshot, logo, or icon
- Accept common 247 CDN image patterns (`s3media.247sports.com` photo URLs) that are action/player photos
- Widen ESPN regex to accept any `espncdn.com` subdomain, not just `a.espncdn.com`

### Technical Details
- 247 images use URLs like `https://s3media.247sports.com/Uploads/Assets/...` — no player slug. Current code filters all of these out because of the `if (!lower.includes(slug)) return false` check
- ESPN CDN uses multiple subdomains: `a.espncdn.com`, `a1.espncdn.com`, `media.espncdn.com`, etc.
- The `ProfilePreview.tsx` missing fields UI will use inline styles (matching the existing component pattern) instead of Tailwind tokens

