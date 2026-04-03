

## Split Recruiting Block into Two Equal Boxes

### Layout Change
Replace the single recruiting card with a `grid grid-cols-2 gap-2` container holding two separate cards of equal width.

### Box 1 — Rating & Ranks
Keep stars + "X-Star" label, National rank, and Position rank exactly as they are now. Remove commitment status and logo from this box.

### Box 2 — Commitment & Logo
- Commitment status pill at top (aligned similarly to stars in box 1)
- School logo below, centered horizontally, sized down to `w-12 h-12`
- Empty states for both (same "Not set" text / shield placeholder)

### File: `src/features/builder/components/IdentityPreview.tsx` (lines 91–140)

Replace the single `div.flex.items-center.gap-4` with:

```tsx
<div className="grid grid-cols-2 gap-2">
  {/* Box 1: Stars + Ranks */}
  <div className="bg-surface-container-high border border-outline-variant/20 rounded-xl p-4">
    {/* Stars row — unchanged */}
    {/* National + Position ranks — unchanged */}
  </div>

  {/* Box 2: Commitment + Logo */}
  <div className="bg-surface-container-high border border-outline-variant/20 rounded-xl p-4 flex flex-col">
    {/* Commitment pill at top */}
    {/* School logo centered below, w-12 h-12 */}
  </div>
</div>
```

### Files modified
- `src/features/builder/components/IdentityPreview.tsx`

