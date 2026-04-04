

## Move Auto-Fill to Onboarding Preview Step

### What Changes

The "Auto-Fill from Web" scraping is removed from the builder's IdentityForm and moved into the onboarding `/onboarding/preview` step. When the athlete arrives at the preview step, they see their mini ProCard and a prominent "Auto-Populate Profile" button. Pressing it triggers the Firecrawl scrape with an animated progress sequence showing contextual status messages. After completion, the profile completion percentage updates live and the CTA changes to "Enter Brand HQ".

### UX Flow

```text
Onboarding preview step loads
  ↓
Mini ProCard + completion % (from onboarding data only)
  ↓
"Auto-Populate My Profile" button (replaces "Do These 3 Things First")
  ↓
User taps → animated progress bar with rotating status messages:
  "Searching recruiting sites..."
  "Locating action photos..."
  "Finding measurables..."
  "Checking school roster..."
  ↓
Results appear inline (same checkbox UI from ScrapeFill)
  ↓
User taps "Apply Selected" → data populates store
  ↓
Completion % animates up to new value
  ↓
"Enter Brand HQ →" button enabled
```

### Files Modified

**`src/features/onboarding/steps/ProfilePreview.tsx`** — major rewrite:
- Remove the "Do These 3 Things First" action items section entirely
- Add three states: `idle` (show auto-populate button), `scraping` (animated progress with status messages), `results` (field/image selection from ScrapeFill logic)
- Scraping state shows a segmented progress bar (matching design system) with rotating status text that cycles through contextual messages every 2-3 seconds
- After apply, recalculate and animate the completion percentage
- Keep the mini ProCard (it updates live as images/data are applied)
- Keep "Enter Brand HQ" CTA at the bottom — always visible, but visually emphasized after auto-fill completes

**`src/features/builder/components/IdentityForm.tsx`** — remove ScrapeFill:
- Remove the `import { ScrapeFill }` line
- Remove the `<ScrapeFill />` component usage from the form
- Keep ScrapeFill.tsx file for now (shared logic), or inline the scraping logic directly into ProfilePreview

**`src/features/builder/components/ScrapeFill.tsx`** — refactor to export reusable logic:
- Extract the scraping + image upload logic into a custom hook `useAutoFill` that can be called from ProfilePreview
- The hook returns: `{ scrape, apply, status, scrapedData, imageUrls, selectedFields, selectedImages, toggleField, toggleImage, sources }`
- This keeps the edge function calling, field selection, and image proxy upload logic in one place

### Scraping Progress Animation

Instead of a generic spinner, show a cinematic progress sequence:
- Segmented progress bar (10 segments, filling left to right over ~15 seconds)
- Status text rotates through contextual messages:
  1. "Searching 247Sports, Rivals, On3..."
  2. "Scanning ESPN profiles..."
  3. "Checking school roster..."
  4. "Locating action photos..."
  5. "Finding measurables..."
  6. "Analyzing results..."
- Each message transitions with a subtle fade
- Uses `#50C4CA` (PlayCoach Steel — we're still in onboarding) for the progress bar fill

### Completion Percentage

After auto-fill applies data, the completion % recalculates using the same weights from the SideNav `computeProfileStrength` logic and animates from old value to new value with a count-up effect.

### Technical Details

- The `useAutoFill` hook wraps `firecrawlApi.fetchAthleteProfile()` and the image proxy upload logic
- It reads `firstName`, `lastName`, `school`, `position`, `number`, `classYear` from `useAthleteStore` automatically
- `formatDisplayValue` helper is shared for height display
- No new edge functions or migrations needed — uses existing `firecrawl-profile` and `image-proxy`

### Files Summary
| File | Action |
|------|--------|
| `src/hooks/useAutoFill.ts` | Create — extracted scraping hook |
| `src/features/onboarding/steps/ProfilePreview.tsx` | Rewrite — add auto-fill flow, remove action items |
| `src/features/builder/components/IdentityForm.tsx` | Edit — remove ScrapeFill import and usage |
| `src/features/builder/components/ScrapeFill.tsx` | Slim down — delegates to useAutoFill hook |

