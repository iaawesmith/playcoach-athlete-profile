

## Fix Black Action Photo Thumbnails

### Problem
The image thumbnails in the scrape results panel appear black because there's an overlay div with `bg-surface/60` (`absolute inset-0`) sitting on top of the entire image. Surface color is `#0b0f12` (near-black) at 60% opacity — this makes the thumbnail almost entirely dark. The ProCard shows the photo fine because it doesn't have this overlay.

### Fix

**`src/features/onboarding/steps/ProfilePreview.tsx`** (line 247) and **`src/features/builder/components/ScrapeFill.tsx`** (line 358):

Change the overlay from covering the full image to only covering the bottom portion where the label sits. Replace:

```
<div className="absolute inset-0 bg-surface/60 flex items-end p-1.5">
```

with a bottom-anchored gradient overlay that only darkens the label area:

```
<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface via-surface/80 to-transparent pt-6 pb-1.5 px-1.5 flex items-end">
```

This keeps the label readable while letting the actual photo be visible.

### Files Modified
- `src/features/onboarding/steps/ProfilePreview.tsx`
- `src/features/builder/components/ScrapeFill.tsx`

