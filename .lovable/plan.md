

## Onboarding Architecture Foundation

Architecture-only scaffold: routes, Zustand store, and empty component shells. No UI styling.

### 1. New Zustand store — `src/store/userStore.ts`

```typescript
interface UserProfile {
  role: 'athlete' | 'coach' | 'trainer' | 'agency' | 'brand' | null
  athleteTier: 'youth' | 'high-school' | 'college' | 'pro' | null
  sport: string | null
  agencyType: 'nil' | 'sports' | 'both' | null
  onboardingComplete: boolean
  onboardingStep: number
  setRole: (role) => void
  setAthleteTier: (tier) => void
  setSport: (sport) => void
  setAgencyType: (type) => void
  completeOnboarding: () => void
  setOnboardingStep: (step) => void
  reset: () => void
}
```

All values default to `null` / `false` / `0`.

### 2. New component files (empty shells with placeholder text)

```
src/features/onboarding/
  OnboardingLayout.tsx        — wrapper, renders <Outlet>, shows current step/progress text
  steps/
    RoleSelection.tsx         — "Role Selection — Athlete | Coach/Trainer | Agency/Brand"
    AthleteTier.tsx           — "Tier Selection — Youth (Coming Soon) | High School (Coming Soon) | College | Pro (Coming Soon)"
    SportSelection.tsx        — "Sport Selection — Football | others Coming Soon"
    CoreSetup.tsx             — "Core Setup — fields vary by role + tier"
    ProfilePreview.tsx        — "Profile Preview — card preview + completion % + 3 next actions"
    AgencySetup.tsx           — "Agency Setup — name, type, logo"
```

Each component reads/writes `useUserStore`, has a "Next" button calling `navigate()` to the next step, and renders a single `<div>` with descriptive placeholder text.

### 3. Placeholder dashboard pages

- `src/pages/AgencyDashboard.tsx` — "Agency Dashboard — Coming Soon"
- `src/pages/CoachDashboard.tsx` — "Coach Dashboard — Coming Soon"

### 4. Route updates in `App.tsx`

```
/onboarding          → OnboardingLayout wrapper
  index              → Navigate to /onboarding/role
  role               → RoleSelection
  tier               → AthleteTier
  sport              → SportSelection
  setup              → CoreSetup
  preview            → ProfilePreview
  agency-setup       → AgencySetup

/builder             → BuilderLayout (existing)
/agency-dashboard    → AgencyDashboard (Coming Soon)
/coach-dashboard     → CoachDashboard (Coming Soon)
*                    → NotFound
```

A top-level `<OnboardingGuard>` component wraps the root route logic:
- If `onboardingComplete === false` and path is `/` or `/builder` → redirect to `/onboarding`
- If `onboardingComplete === true` and path is `/` → redirect to `/builder`

### 5. Step navigation logic inside components

| From | Condition | Next |
|------|-----------|------|
| RoleSelection | athlete selected | `/onboarding/tier` |
| RoleSelection | coach or trainer | `/onboarding/sport` |
| RoleSelection | agency or brand | `/onboarding/agency-setup` |
| AthleteTier | college selected | `/onboarding/sport` |
| AthleteTier | other tiers | disabled (Coming Soon) |
| SportSelection | football selected | `/onboarding/setup` |
| SportSelection | other sports | disabled (Coming Soon) |
| CoreSetup | any | `/onboarding/preview` |
| ProfilePreview | athlete+college | completes → `/builder` |
| ProfilePreview | coach/trainer | completes → `/coach-dashboard` |
| AgencySetup | any | `/onboarding/preview` then completes → `/agency-dashboard` |

### Files created
- `src/store/userStore.ts`
- `src/features/onboarding/OnboardingLayout.tsx`
- `src/features/onboarding/steps/RoleSelection.tsx`
- `src/features/onboarding/steps/AthleteTier.tsx`
- `src/features/onboarding/steps/SportSelection.tsx`
- `src/features/onboarding/steps/CoreSetup.tsx`
- `src/features/onboarding/steps/ProfilePreview.tsx`
- `src/features/onboarding/steps/AgencySetup.tsx`
- `src/pages/AgencyDashboard.tsx`
- `src/pages/CoachDashboard.tsx`

### Files modified
- `src/App.tsx` — add all new routes + onboarding guard logic

