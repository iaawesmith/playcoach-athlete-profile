

## Restructure Star Rating + Commitment Status Row

### What changes

Replace the current star rating (5 circle buttons in its own card) and commitment status (standalone `SelectCard` below the rank row) with a **single 2-column row** containing:
- **Star Rating** as a `SelectCard` dropdown (options: 1–5)
- **Commitment Status** as a `SelectCard` dropdown

This row sits directly above the existing National Rank / Position Rank 2-column row, both using `grid grid-cols-2 gap-4` so they align perfectly.

### Changes in `src/features/builder/components/IdentityForm.tsx`

**Lines 754–796**: Replace the star rating card (circle buttons) + the national/position rank row + the standalone commitment status `SelectCard` with:

```
{/* Star Rating + Commitment Status — 2-col */}
<div className="grid grid-cols-2 gap-4">
  <SelectCard
    label="Star Rating"
    value={starRating ? String(starRating) : ""}
    options={[
      { label: "1 Star", value: "1" },
      { label: "2 Stars", value: "2" },
      { label: "3 Stars", value: "3" },
      { label: "4 Stars", value: "4" },
      { label: "5 Stars", value: "5" },
    ]}
    onChange={(v) => setAthlete({ starRating: v ? Number(v) : 0 })}
  />
  <SelectCard
    label="Commitment Status"
    value={commitmentStatus}
    options={commitmentOptions}
    onChange={(v) => setAthlete({ commitmentStatus: v as "" | "committed" | "uncommitted" | "portal" })}
  />
</div>

{/* National Rank + Position Rank — 2-col (unchanged) */}
<div className="grid grid-cols-2 gap-4">
  <InputCard label="National Rank" ... />
  <InputCard label="Position Rank" ... />
</div>
```

Both rows use identical `grid grid-cols-2 gap-4`, ensuring perfect vertical alignment.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

