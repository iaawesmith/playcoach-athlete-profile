

## Remove Dot + Make Header Bars Taller & Centered

### 1. Remove dot from "Publish changes via the icon above" (`BuilderLayout.tsx`, line 58)

Delete the `<span className="w-1.5 h-1.5 rounded-full bg-white" />` element from the unpublished state subtext block (line 58). Keep only the text span.

### 2. Increase all three header bars from `h-12` (48px) to `h-14` (56px) and center content

**SideNav header** (`SideNav.tsx`, line 38):
- Change `h-12` → `h-14`
- Keep `flex flex-col justify-center` for vertical centering

**Preview header** (`BuilderLayout.tsx`, line 44):
- Change `h-12` → `h-14`
- Keep `flex items-center` for vertical centering

**Editor header** (`BuilderLayout.tsx`, line 95):
- Change `h-12` → `h-14`
- Keep `flex flex-col justify-center` for vertical centering

All three bars get the same height bump (48px → 56px), content stays vertically centered via existing flex properties.

### Files modified
- `src/features/builder/BuilderLayout.tsx`
- `src/features/builder/components/SideNav.tsx`

