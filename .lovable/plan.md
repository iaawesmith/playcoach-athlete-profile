

## Update Role Selection Screen

### Changes to `src/features/onboarding/steps/RoleSelection.tsx`

**1. Split into 4 separate roles**: Athlete, Coach, Trainer, Agency (remove combined labels)

**2. Make Athlete prominent**: Apply `#50C4CA` teal to the Athlete card's icon and label text by default (not just on selection). Give it a subtle teal border glow to stand out.

**3. Center "Coming Soon" badges**: Move from `absolute top-3 right-3` to centered within the card (below the description text), removing absolute positioning.

**4. Grid layout**: Change to `md:grid-cols-4` for the four cards, or keep responsive with `sm:grid-cols-2 md:grid-cols-4`.

### Changes to `src/features/onboarding/OnboardingLayout.tsx`

**5. Add PlayCoach logo**: Import `playcoach-logo.png` from `@/assets/playcoach-logo.png` (same asset used in builder TopNav) and replace the text "PlayCoach" with the `<img>` logo.

### Role Cards Data
```text
Athlete   → icon: person,          "Build your identity"                    → active
Coach     → icon: sports,          "Develop and track athletes"             → coming soon
Trainer   → icon: exercise,        "Train and measure performance"          → coming soon
Agency    → icon: business_center, "Manage athletes and partnerships"       → coming soon
```

### Files Modified
- `src/features/onboarding/steps/RoleSelection.tsx`
- `src/features/onboarding/OnboardingLayout.tsx`

