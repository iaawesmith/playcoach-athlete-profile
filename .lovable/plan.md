

## Fix School Logo Alignment in Recruiting Block

The logo is currently pushed to the far right by `justify-between` and is 48×48px which feels small relative to the card content. Two changes:

### Change — `src/features/builder/components/IdentityPreview.tsx`

**Line 91**: Change the container from `flex items-center justify-between` to `flex items-center gap-4` — this keeps the logo closer to the content instead of pushing it to the far edge.

**Line 137**: Increase logo size from `w-12 h-12` to `w-16 h-16` (64×64px) for better visual balance.

**Line 132**: Wrap the logo in a `ml-auto` container so it still sits on the right side but with natural spacing rather than being pinned to the edge.

Updated structure:
```tsx
<div className="bg-surface-container-high border border-outline-variant/20 rounded-xl p-4 flex items-center gap-4">
  <div className="flex-1">
    {/* Stars, Ranks, Commitment badge — unchanged */}
  </div>
  {commitmentStatus === "committed" && schoolLogoUrl && (
    <img
      src={schoolLogoUrl}
      alt="School logo"
      className="w-16 h-16 rounded-lg object-contain"
    />
  )}
</div>
```

### Files modified
- `src/features/builder/components/IdentityPreview.tsx`

