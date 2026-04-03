

## Two Fixes: Amber Publish Icon + Subtext Display

### 1. Publish icon color — amber when unpublished (`TopNav.tsx`, line 31)

Change the `publish` icon color from `text-on-surface-variant` to `#F59E0B` (amber) to signal that changes need attention.

```tsx
<span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#F59E0B" }}>publish</span>
```

### 2. Subtext not displaying — debug (`BuilderLayout.tsx`, lines 50–61)

The subtext code looks correct in the source. The issue is likely that it's only visible on `lg:` screens (the preview column has `hidden lg:flex`). At 1104px viewport width, `lg` (1024px) should apply. Let me check if the text is being clipped or if there's a conditional preventing it.

The subtext references `hasBeenPublished` and `hasUnpublishedChanges` from the store. On initial load, `hasBeenPublished` is `false` and `hasUnpublishedChanges` is `false`, so the else branch fires showing "Publish changes via the icon above" — this is correct behavior. The text should be visible.

Possible issue: the text might be too long for the container and getting clipped. I'll add `whitespace-nowrap` removal or ensure the container allows wrapping.

### Files modified
- `src/features/builder/components/TopNav.tsx` — change publish icon color to `#F59E0B`
- `src/features/builder/BuilderLayout.tsx` — verify subtext renders (may need minor layout fix)

