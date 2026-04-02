

## Move School Logo Left in Recruiting Block

The logo currently sits at the right edge due to the `gap-4` spacing with `flex-1` on the left content. To pull it closer to the left content, reduce the gap or add negative margin.

### Change — `src/features/builder/components/IdentityPreview.tsx`

**Line 137**: Add `-mr-2` to the logo to pull it a couple spaces to the left, away from the card edge.

```tsx
// Before
className="w-16 h-16 rounded-lg object-contain"

// After
className="w-16 h-16 rounded-lg object-contain -mr-2"
```

Alternatively, if the intent is to bring it closer to the text content, we could also increase the right padding on the card or reduce gap. The `-mr-2` approach is simplest — nudges the logo ~8px left from the card edge.

### Files modified
- `src/features/builder/components/IdentityPreview.tsx`

