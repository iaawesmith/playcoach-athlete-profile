
Fix black action-photo candidate previews on onboarding

What’s happening
- On `/onboarding/preview`, there is only one action-photo tile that cycles through 3 candidates.
- In `src/features/onboarding/steps/ProfilePreview.tsx`, that tile gets a full-cover dark refresh overlay (`bg-surface/70`) while hovering/clicking, which makes the photo look black during interaction.
- Also, `supabase/functions/firecrawl-profile/index.ts` returns raw remote image URLs without validating that they are actually browser-renderable images. When one fails, the current `<img onError>` behavior hides the image and leaves a black box.

Plan
1. Fix the onboarding cycling UI
   - In `src/features/onboarding/steps/ProfilePreview.tsx`, remove the full-image dark refresh overlay for action-photo cycling.
   - Replace it with a small top-right control/pill (refresh icon + `1/3`) so the photo stays visible at all times.

2. Add broken-image fallback in onboarding
   - In `src/hooks/useAutoFill.ts`, track failed action-photo candidates.
   - When the current candidate fails to load, automatically advance to the next candidate instead of hiding the image and leaving a black tile.
   - If all candidates fail, clear the previewed action photo and show a lightweight fallback message/state.

3. Harden the backend candidate list
   - In `supabase/functions/firecrawl-profile/index.ts`, validate each candidate URL before returning it.
   - Keep only candidates that respond like real images (`image/*`, non-empty, not HTML/error payloads).
   - Set `imageUrls.actionPhoto` from the first verified candidate so onboarding and Brand HQ both get safer defaults.

Files to modify
- `src/features/onboarding/steps/ProfilePreview.tsx`
- `src/hooks/useAutoFill.ts`
- `supabase/functions/firecrawl-profile/index.ts`

Technical details
- Replace full-cover candidate overlay with a compact corner control.
- Move action-photo error handling into the hook instead of `style.display = "none"`.
- Server-side candidate validation should filter out blocked/empty image URLs before they ever reach the client.
