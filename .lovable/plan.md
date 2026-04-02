

## Add Separators to Upcoming Game Detail Row

The time field is already in the code (`upcomingGame.time` on line 174), so it renders when game data exists. The readability issue is that date, time, network, and location run together with only gap spacing.

### Change — `src/features/builder/components/IdentityPreview.tsx`

Lines 172–177: Replace the plain `flex gap-x-4` row with items separated by `|` pipe characters styled in `text-on-surface-variant/30`.

**Before:**
```tsx
<div className="flex flex-wrap gap-x-4 gap-y-1 text-on-surface-variant text-xs">
  <span>{formatGameDate(upcomingGame.date)}</span>
  <span>{upcomingGame.time}</span>
  <span>{upcomingGame.network}</span>
  <span>{upcomingGame.location}</span>
</div>
```

**After:**
```tsx
<div className="flex flex-wrap items-center gap-y-1 text-on-surface-variant text-xs">
  <span>{formatGameDate(upcomingGame.date)}</span>
  <span className="mx-2 text-on-surface-variant/30">|</span>
  <span>{upcomingGame.time}</span>
  <span className="mx-2 text-on-surface-variant/30">|</span>
  <span>{upcomingGame.network}</span>
  <span className="mx-2 text-on-surface-variant/30">|</span>
  <span>{upcomingGame.location}</span>
</div>
```

The pipes sit at 30% opacity — visible enough to separate items clearly, but not heavy enough to compete with the actual content. `mx-2` gives comfortable breathing room on each side.

### Files modified
- `src/features/builder/components/IdentityPreview.tsx`

