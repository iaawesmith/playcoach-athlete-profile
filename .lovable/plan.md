

## Replace "Add Your Action Photo" Text with Silhouette

### Problem
The empty photo state on `/onboarding/preview` shows "Add Your Action Photo" — misleading because users can't upload on this screen. The scrape handles photo population.

### Fix

**`src/features/builder/components/ProCard.tsx`** (lines 39-44)

Replace the text prompt with a subtle athlete silhouette SVG. Use an inline SVG of a standing athlete figure, rendered at ~7% opacity in `text-on-surface-variant`, centered in the photo area. No text, no CTA — just a faint visual placeholder consistent with the AGENTS.md spec ("white, ~7% opacity silhouette SVG").

The silhouette will be a simple athletic figure (arms slightly out, standing pose) drawn as an SVG path, sized ~120px tall, centered vertically in the top 60% of the card.

### Files Modified
- `src/features/builder/components/ProCard.tsx`

