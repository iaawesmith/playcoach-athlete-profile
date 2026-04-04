

## Fix Role Selection Card Alignment and Width

### Problem
Cards have inconsistent vertical alignment — icons, titles, descriptions, and "Coming Soon" badges don't line up horizontally across the four cards because `flex` with `gap-4` and variable content heights causes misalignment. The container also needs to be wider.

### Solution
Replace the flex layout inside each card with a **fixed-height slot** approach. Each card uses the same internal structure with consistent spacing, and cards without "Coming Soon" still reserve space for it. This guarantees horizontal alignment across all four.

### Changes to `src/features/onboarding/steps/RoleSelection.tsx`

1. **Widen container**: Change `max-w-6xl` to `max-w-7xl` for a wider background box
2. **Replace flex-col gap layout with grid rows**: Each card becomes a grid with fixed row template: icon (64px) → title (24px) → description (48px) → badge (24px). This locks every element to the same vertical position across all cards.
3. **Reserve "Coming Soon" space**: All cards render the badge row — non-coming-soon cards render an invisible placeholder to keep alignment
4. **Increase card min-height**: Bump to `min-h-[240px]` for more breathing room

### Technical detail

```tsx
<button className="grid grid-rows-[64px_24px_48px_24px] items-center justify-items-center w-full min-h-[240px] py-6 px-4 rounded-xl border ...">
  <span className="material-symbols-outlined text-5xl">{icon}</span>
  <span className="font-black text-sm uppercase tracking-[0.2em]">{label}</span>
  <span className="text-on-surface-variant text-sm text-center">{description}</span>
  {r.comingSoon ? <badge /> : <span className="invisible">.</span>}
</button>
```

### Files Modified
- `src/features/onboarding/steps/RoleSelection.tsx`

