

## Move Upload Labels Above the Boxes

One file change in `IdentityForm.tsx`. Restructure both upload slots so the label sits above the button (like `InputCard` does), not inside it.

### Change — `src/features/builder/components/IdentityForm.tsx`

For both Action Photo and School Logo, wrap each in a small container:

1. **Label** above the button: `text-[10px] font-medium uppercase tracking-widest text-on-surface-variant` — always reads "Action Photo" / "School Logo" regardless of upload state.
2. **Button** below: same styling as now, but remove the label `<span>` from inside. When a photo is uploaded, show the preview image + a smaller "Change" prompt. When empty, show the icon + helper text only.

Result: labels are always visible, matching every other field. The upload area is cleaner — just the visual content and a subtle change prompt when filled.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

