

## Fix Team Color Not Carrying Over to Onboarding Preview

### Problem
The `ProCard` component uses `var(--team-color)` CSS variable for the school banner, position badges, and jersey number badges. The `BuilderLayout` sets this variable on its root div using the Zustand `teamColor` value, but the `OnboardingLayout` does not. So on `/onboarding/preview`, the ProCard falls back to `#CC0000` (the CSS default in `index.css`), which is why it appears red regardless of which school was selected.

### Fix — `src/features/onboarding/OnboardingLayout.tsx`

1. Import `useAthleteStore` and read `teamColor` from the store
2. On the root `<div>` (line 31), set the `--team-color` CSS variable inline — identical to how `BuilderLayout` does it:
   ```tsx
   style={{ "--team-color": teamColor } as React.CSSProperties}
   ```

This ensures the ProCard (and any other element using `var(--team-color)`) renders with the correct school color throughout the onboarding flow.

### Also fix the CSS default
Update `index.css` line 51: change `--team-color: #CC0000` to `--team-color: #50C4CA` so the fallback matches the store default (PlayCoach Steel for onboarding context), not Georgia Red.

### Files Modified
- `src/features/onboarding/OnboardingLayout.tsx`
- `src/index.css`

