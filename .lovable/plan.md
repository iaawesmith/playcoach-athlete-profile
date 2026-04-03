

## Move Star Label Above Stars + Rename Rank Labels

### Changes in `src/features/builder/components/IdentityPreview.tsx`

**1. Add `position` to destructured store values (line 39)**

**2. Restructure Box 1 (lines 93–119):**

- Move "{starRating}-Star" text **above** the stars row as a title label (same style as other section labels: `text-[9px] font-bold uppercase tracking-widest`, teamColor)
- Remove the inline `{starRating}-Star` span from beside the stars
- Rename "National" label → "NAT."
- Rename "Position" label → dynamic `position || "POS."` (shows "WR", "QB", etc. based on athlete's selected position, falls back to "POS." if none set)

**Result:**
```
4-STAR               ← title, teamColor
★ ★ ★ ★ ☆           ← stars row only, no trailing text
NAT.       WR        ← dynamic position abbreviation
#50        #9
```

### Files modified
- `src/features/builder/components/IdentityPreview.tsx`

