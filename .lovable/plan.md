

## Show School Logo on ProCard During Onboarding Preview

### Problem
When auto-populate results come back, the ProCard live preview updates `actionPhotoUrl`, `height`, and `weight` immediately — but `schoolLogoUrl` is not set on the store until the user clicks "Apply Selected." So the school logo doesn't appear on the ProCard during the review step.

### Fix
In `src/hooks/useAutoFill.ts`, add `schoolLogoUrl` to the live preview block (lines 122-131). When `result.imageUrls?.schoolLogo` exists, immediately set it on the store so the ProCard renders the logo at bottom-right — same position as in the builder.

Also save the original `schoolLogoUrl` in `originalValues` (line 94-98) so it restores on dismiss.

### Changes

**`src/hooks/useAutoFill.ts`**
- Line 95-98: Add `schoolLogoUrl: useAthleteStore.getState().schoolLogoUrl` to `originalValues`
- Line 124-128: Add `if (result.imageUrls?.schoolLogo) preview.schoolLogoUrl = result.imageUrls.schoolLogo;` to the live preview block

Two lines changed, same file. The ProCard component already renders the logo at `absolute bottom-3 right-3` when `schoolLogoUrl` is truthy — no changes needed there.

### Files Modified
- `src/hooks/useAutoFill.ts`

