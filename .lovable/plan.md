

## Widen Preview Header to Full Column Width

Currently the header row (section title + Go Live/Share icons + Draft/Live status) is constrained to `max-w-sm mx-auto` — the same width as the ProCard. This makes it look like the title and icons are pinned to the card rather than spanning the full preview column.

### Change — `src/features/builder/BuilderLayout.tsx`

Line 49: Remove `max-w-sm mx-auto` from the header wrapper. Replace with full-width padding that aligns to the column edges:

```
- <div className="relative z-10 w-full max-w-sm mx-auto pt-8 px-4">
+ <div className="relative z-10 w-full pt-8 px-8">
```

This makes the section title ("Identity Preview", etc.) sit flush-left within the column at the same `px-8` as the preview content below it (line 101 uses `px-8`), and pushes the Go Live + Share icons to the right edge of the column.

No other files modified — single line change.

### Files modified
- `src/features/builder/BuilderLayout.tsx`

