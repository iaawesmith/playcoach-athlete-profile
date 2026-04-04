

## Action Photo Preview on Card + "Find Another" Button

### What It Does
1. When auto-fill results come back with an action photo, the photo immediately previews on the ProCard (live, before applying).
2. A refresh icon appears on hover over the action photo thumbnail in the results grid. Clicking it searches for another action photo option.
3. The ProCard updates in real-time as you cycle through different action photo candidates.

### How It Works

**Edge function change: `supabase/functions/firecrawl-profile/index.ts`**
- Return ALL candidate action photo URLs (up to 10) in a new `actionPhotoCandidates` array alongside the AI-picked best one in `imageUrls.actionPhoto`.
- This gives the frontend a pool to cycle through without making new API calls each time.

**Hook change: `src/hooks/useAutoFill.ts`**
- Add `actionPhotoCandidates: string[]` state to store the full list of candidate URLs.
- Add `activeActionPhotoIndex: number` state tracking which candidate is currently shown.
- Add `nextActionPhoto()` callback that increments the index (wraps around) and updates `imageUrls.actionPhoto` to the next candidate.
- Add `previewActionPhotoUrl: string | null` — the currently previewed (but not yet applied) action photo URL.
- When results arrive, temporarily set the store's `actionPhotoUrl` to the first candidate so the ProCard shows a live preview. Track original value to restore if user dismisses.
- On `nextActionPhoto()`, update the store's `actionPhotoUrl` immediately so the ProCard reflects the new choice.
- Expose `hasMultipleActionPhotos: boolean` and `nextActionPhoto` from the hook.

**UI change: `src/features/onboarding/steps/ProfilePreview.tsx`**
- On the action photo thumbnail in the image results grid, add a hover overlay with a `refresh` Material Symbol icon. Clicking calls `autoFill.nextActionPhoto()`.
- The ProCard above already reads from the store, so it updates automatically when the preview URL changes.
- When user clicks "Apply Selected", the currently previewed action photo is the one that gets uploaded and persisted.

### Why No Extra API Calls
The edge function already searches for photos and collects candidate URLs. Instead of discarding all but the AI pick, we return the full candidate list. Cycling through them is instant — no new scrapes needed. If the user exhausts all candidates and still isn't satisfied, a "Search for more" option could trigger a new search (future enhancement).

### Files Modified
- `supabase/functions/firecrawl-profile/index.ts` — return `actionPhotoCandidates` array
- `src/hooks/useAutoFill.ts` — candidate cycling logic + live preview on store
- `src/features/onboarding/steps/ProfilePreview.tsx` — refresh icon overlay on action photo thumbnail
- `src/services/firecrawl.ts` — add `actionPhotoCandidates` to `ProfileResponse` type

