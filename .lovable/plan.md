

## Remove Silhouette from ProCard Empty State

### Change
In `src/features/builder/components/ProCard.tsx`, remove the entire `else` block (lines 39-47) that renders the athlete silhouette SVG when no action photo is present. The empty photo area will just show the dark `bg-surface-container-high` background with no text or icon.

### Files Modified
- `src/features/builder/components/ProCard.tsx`

