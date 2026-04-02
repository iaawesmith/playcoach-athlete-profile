

## Show School Logo in Recruiting Block When Committed

When `commitmentStatus === "committed"` and `schoolLogoUrl` exists, display the school logo on the right side of the recruiting card. This visually reinforces the commitment destination.

### Change — `src/features/builder/components/IdentityPreview.tsx`

Lines 90–130: Restructure the recruiting card interior to use a flex layout with the existing content on the left and the school logo on the right.

**Current:** Single-column content (stars → ranks → badge).

**New:** Wrap in `flex justify-between items-center`. Left side keeps all existing content. Right side renders the school logo (48×48, rounded-lg, object-contain) only when `commitmentStatus === "committed"` and `schoolLogoUrl` is truthy.

```tsx
<div className="bg-surface-container-high border border-outline-variant/20 rounded-xl p-4 flex items-center justify-between">
  <div>
    {/* Stars, Ranks, Commitment badge — unchanged */}
  </div>
  {commitmentStatus === "committed" && schoolLogoUrl && (
    <img
      src={schoolLogoUrl}
      alt="School logo"
      className="w-12 h-12 rounded-lg object-contain"
    />
  )}
</div>
```

The logo only appears when both conditions are met — committed + logo uploaded. Uncommitted or portal athletes see no change. No logo uploaded means no change either.

### Files modified
- `src/features/builder/components/IdentityPreview.tsx`

