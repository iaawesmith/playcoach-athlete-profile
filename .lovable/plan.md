

## Color the Hex Text to Match the Team Color

### Change in `src/features/builder/components/IdentityForm.tsx`

**Line 673–674**: Change the input text color from static `text-on-surface` to a dynamic inline style using the `teamColor` value.

Change:
```
<input
  className="w-full bg-transparent text-on-surface text-sm font-normal outline-none"
  value={teamColor}
```
To:
```
<input
  className="w-full bg-transparent text-sm font-normal outline-none"
  style={{ color: teamColor }}
  value={teamColor}
```

The hex text (e.g. `#CC0000`) will now render in its own color, giving instant visual feedback alongside the swatch.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

