

## Two Updates: Preview Header Teal Fill + TopNav Adjustments

### 1. Live Preview Header — Full Teal Background (`BuilderLayout.tsx`, line 47)

Replace the current `bg-surface-container-high` + `border-l-2` with a full `bg-[#50C4CA]` background. Change all text/icons to white. Remove the left border accent.

- Header bar: `bg-[#50C4CA]` instead of `bg-surface-container-high`, remove `borderLeft` inline style
- Visibility icon: `color: "#FFFFFF"`
- Title text: `text-white` instead of `text-on-surface`
- Draft dot: `bg-white` instead of `bg-amber-400`, text `text-white`
- Live dot: `bg-white` instead of `bg-primary`, text `text-white`

### 2. TopNav Adjustments (`TopNav.tsx`, lines 14–18)

- Remove the "Brand HQ" span entirely (line 18)
- Add a share/link icon button immediately after the athlete name
- The GO LIVE button (currently in preview header) stays where it is — this request refers to the share button moving from the preview header to the TopNav, inline after the name

Wait — re-reading: "Move the share/link icon to sit immediately to the right of the athlete name, inline" and "The GO LIVE button stays in its current position — it simply shifts right to occupy the space where the link icon was." This means:
- In TopNav: remove "Brand HQ", add a `link` icon right after the athlete name
- In the preview header: remove the share button, let the GO LIVE button shift into that space

### Files modified
- `src/features/builder/components/TopNav.tsx` — remove "Brand HQ" text, add link/share icon after athlete name
- `src/features/builder/BuilderLayout.tsx` — preview header: full teal bg, white text/icons, remove border-l; remove share button from preview header

