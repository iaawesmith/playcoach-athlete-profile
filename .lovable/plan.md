

## Update Preview Header Banner to Team Color

### Change in `src/features/builder/BuilderLayout.tsx`

**Line 44**: Replace the hardcoded teal `bg-[#50C4CA]` with a dynamic inline style using `var(--team-color)`.

Change:
```
<div className="h-14 px-5 py-3 bg-[#50C4CA] border-b border-white/10 shrink-0 flex items-center z-10">
```
To:
```
<div className="h-14 px-5 py-3 border-b border-white/10 shrink-0 flex items-center z-10" style={{ backgroundColor: "var(--team-color)" }}>
```

This ensures the preview header banner always matches the athlete's school color, staying consistent with the ProCard banner, nav accents, and other teamColor-driven elements.

### Files modified
- `src/features/builder/BuilderLayout.tsx`

