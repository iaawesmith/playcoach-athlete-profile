

## Make Role Selection Cards Wider

Increase the horizontal padding and add a minimum width to each card so they feel more spacious.

### Change in `src/features/onboarding/steps/RoleSelection.tsx`

- Line 66: Change `gap-4` to `gap-6` and add `max-w-4xl mx-auto` to the grid so it centers with more room
- Line 75: Change card padding from `p-8` to `px-12 py-8` for wider horizontal spacing

