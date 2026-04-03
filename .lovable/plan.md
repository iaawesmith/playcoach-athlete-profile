

## Add Blank Placeholder to Star Rating Dropdown

### Change in `src/features/builder/components/IdentityForm.tsx`

**Lines 758–764**: Add a blank placeholder option at the top of the Star Rating options array:

```
options={[
  { label: "Select...", value: "" },
  { label: "1 Star", value: "1" },
  { label: "2 Stars", value: "2" },
  { label: "3 Stars", value: "3" },
  { label: "4 Stars", value: "4" },
  { label: "5 Stars", value: "5" },
]}
```

The `value` logic already handles this: `starRating ? String(starRating) : ""` maps to `""` when unset, and `onChange` converts back: `v ? Number(v) : 0`.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

