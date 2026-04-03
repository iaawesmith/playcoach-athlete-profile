

## Dynamic Position Rank Label

### Change in `src/features/builder/components/IdentityForm.tsx`

**Line 784**: Replace the static `"Position Rank"` label with a dynamic one based on the athlete's selected position.

Change:
```
label="Position Rank"
```
To:
```
label={position ? `${position} Rank` : "Position Rank"}
```

This uses the `position` value from the store (e.g. "QB", "WR", "RB") to show "QB Rank", "WR Rank", etc. Falls back to "Position Rank" when no position is selected.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

