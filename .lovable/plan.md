

## Auto-Fetch School Logo on School Selection

### What It Does
When a user selects or enters a school name (e.g. "Brigham Young Cougars"), the system automatically searches for the school's official logo using Firecrawl and populates the school logo upload field — no manual upload needed.

### How It Works

1. **New edge function `firecrawl-school-logo`** — A lightweight function that takes a school name, uses Firecrawl search with `branding` format to find the school's athletics site, and returns the best logo URL. This is simpler and faster than the full `firecrawl-profile` function.

2. **New service method** — Add `fetchSchoolLogo(schoolName: string)` to `src/services/firecrawl.ts` that invokes the new edge function.

3. **Trigger on school selection in `IdentityForm.tsx`** — When a user selects a school from the autocomplete (the `onSelect` handler around line 655), if `schoolLogoUrl` is not already set, automatically call the new service in the background. Show a subtle loading pulse on the school logo upload slot while fetching. On success, upload the image via the existing `image-proxy` function and set `schoolLogoUrl` in the store.

4. **Non-blocking UX** — The logo fetch runs in the background. The user can continue editing. If it fails or finds nothing, the upload slot stays empty and the user can still upload manually. If the user has already uploaded a logo, the auto-fetch is skipped.

### Technical Details

**New file: `supabase/functions/firecrawl-school-logo/index.ts`**
- Accepts `{ school: string }`
- Searches Firecrawl for `"{school} athletics official logo"` with `branding` format
- Falls back to searching `"{school} logo site:espn.com OR site:ncaa.com"` with `screenshot` format if branding yields nothing
- Returns `{ success: true, logoUrl: string }` or `{ success: false }`

**Modified: `src/services/firecrawl.ts`**
- Add `fetchSchoolLogo(school: string)` method

**Modified: `src/features/builder/components/IdentityForm.tsx`**
- In the `onSelect` callback for `SchoolAutocomplete`, trigger logo fetch if no logo is set
- Add local state `logoLoading` to show pulse animation on the logo upload slot
- Use `image-proxy` to upload the found logo to storage, then set `schoolLogoUrl`

### Files Modified
- `supabase/functions/firecrawl-school-logo/index.ts` (new)
- `src/services/firecrawl.ts`
- `src/features/builder/components/IdentityForm.tsx`

