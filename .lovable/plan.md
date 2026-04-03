

## Add Icons and Color Accents to Three Column Headers

### Changes

**1. SideNav header** (`src/features/builder/components/SideNav.tsx`, line 39)

Add `person` icon before "Brand HQ" title:
```tsx
<div className="flex items-center gap-1.5">
  <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: "18px" }}>person</span>
  <span className="text-on-surface font-bold uppercase text-xs tracking-widest">Brand HQ</span>
</div>
```

No border accent — stays neutral.

**2. Preview header** (`src/features/builder/BuilderLayout.tsx`, line 49)

Add `visibility` icon before the section label, colored `#50C4CA`. The `border-l-2` in `#50C4CA` already exists on this header — no change needed there.

```tsx
<div className="flex items-center gap-1.5">
  <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#50C4CA" }}>visibility</span>
  <span className="text-on-surface font-bold uppercase text-xs tracking-widest">{sectionLabels[activeSection]}</span>
</div>
```

**3. Editor header** (`src/features/builder/BuilderLayout.tsx`, line 124–125)

Change `edit` icon color to `#00e639` and size to 18px. Add `border-l-2` in `#00e639` to the header bar via inline style.

```tsx
<div className="h-12 px-5 py-3 bg-surface-container-high border-b border-white/10 shrink-0 flex flex-col justify-center"
     style={{ borderLeft: "2px solid #00e639" }}>
  <div className="flex items-center gap-1.5">
    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#00e639" }}>edit</span>
```

### Files modified
- `src/features/builder/components/SideNav.tsx`
- `src/features/builder/BuilderLayout.tsx`

