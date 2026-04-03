

## Hover Overlay for Upload Boxes

### What changes
Remove the static titles ("Action Photo", "Profile Picture", "School Logo") above each upload box and the "Tap to change" text. Instead, when hovering over a filled upload box, show a dark overlay with the title in white and a `swap_horiz` (or `cached`) icon for replacing the image.

### Changes in `src/features/builder/components/IdentityForm.tsx`

**1. Remove `<label>` elements** above each of the three upload boxes (lines 492–495, 514–517, 536–539).

**2. Remove `flex flex-col gap-1.5` wrapper divs** — each button becomes the direct grid child.

**3. For filled state of each box**, replace the current `<img>` + "Tap to change" with:
```tsx
<div className="relative w-full h-full group/img">
  <img src={url} alt="..." className="w-full h-full object-cover rounded-xl" />
  <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200">
    <span className="material-symbols-outlined text-white text-xl">swap_horiz</span>
    <span className="text-white text-[9px] font-bold uppercase tracking-widest">Action Photo</span>
  </div>
</div>
```
Each box gets its own label text ("ACTION PHOTO", "PROFILE PICTURE", "SCHOOL LOGO").

**4. Empty state stays unchanged** — icon + helper text, no title needed since the helper text already describes purpose.

**5. Button styling update** — add `group/img overflow-hidden` and set a fixed `min-h-[100px]` so the overlay covers the full box area.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

