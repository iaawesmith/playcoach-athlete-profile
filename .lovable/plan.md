

## Add Consistent Sticky Header Band Across All Three Columns

Three header bars — same height (48px), same bg/border, different content and accent — forming a continuous visual band below the TopNav.

### 1. SideNav (`src/features/builder/components/SideNav.tsx`)

**Add a sticky header bar** at the top of the aside, before the current profile header content:
- `h-12 px-5 py-3 bg-surface-container-high border-b border-white/10`
- Line 1: "BRAND HQ" — `text-on-surface font-bold uppercase text-xs tracking-widest`
- Line 2: "Build your profile to 100%" — `text-on-surface-variant text-[0.65rem] italic`
- No accent color (neutral)

**Move** the existing "Brand HQ" h2 out (replaced by the header bar). The Profile Strength label, percentage, and segmented bar stay below the header in the scrollable area, inside the existing `p-6 space-y-4` block.

### 2. Center Column — Preview (`src/features/builder/BuilderLayout.tsx`)

**Replace** the current floating header (lines 49–98: the `pt-8 px-8` div with section label, publish/share buttons, and draft/live status) with a **sticky header bar** inside a flex-col + overflow structure:

- Outer div becomes `flex flex-col overflow-hidden` (like the editor column already does)
- Header bar: `h-12 px-5 py-3 bg-surface-container-high border-b border-white/10 shrink-0 flex items-center` with a `border-l-2` in `#50C4CA`
- Line 1: `"IDENTITY LIVE PREVIEW"` — same font treatment as the other bars. Updates per section.
- Line 2: Draft/Live status dot + text moves here as subtext (same `text-[0.65rem]` italic style)
- Publish + Share buttons move to the right side of this header bar
- Scrollable preview content below: `flex-1 overflow-y-auto`

Section label map updates from `"Identity Preview"` → `"Identity Live Preview"`, etc.

### 3. Right Column — Editor (`src/features/builder/BuilderLayout.tsx`)

**Update** the existing sticky editor header (lines 126–136) to match the 48px height:
- Change from `px-6 py-3` to `h-12 px-5 py-3 shrink-0 flex flex-col justify-center`
- Keep content as-is (edit icon + "EDITING IDENTITY" + subtext)
- Already has `bg-surface-container-high border-b border-white/10`

### Files modified
- `src/features/builder/components/SideNav.tsx` — replace "Brand HQ" header with 48px sticky bar, keep strength bar below
- `src/features/builder/BuilderLayout.tsx` — restructure center column with sticky header, update editor header height

