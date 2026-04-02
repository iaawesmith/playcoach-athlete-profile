

## Standardize "40 Time" Label Across All Surfaces

Three instances to update to "40 TIME" (rendered uppercase via CSS):

| File | Current | New |
|------|---------|-----|
| `ProCard.tsx` line 35 | `"40-YD"` | `"40 TIME"` |
| `IdentityPreview.tsx` line 78 | `"40-Yard"` | `"40 Time"` |
| `IdentityForm.tsx` line 498 | `"40 Time"` | no change needed |

The form already says "40 Time". The ProCard and preview labels are rendered uppercase via CSS, so casing in the prop doesn't matter — but we'll use "40 Time" for consistency in source.

### Files modified
- `src/features/builder/components/ProCard.tsx` — line 35
- `src/features/builder/components/IdentityPreview.tsx` — line 78

