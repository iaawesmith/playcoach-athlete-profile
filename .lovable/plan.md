

## Add Skip Button to Onboarding Preview

Add a "Skip" button visible during the `idle` state (before auto-populate is triggered) that lets users bypass the auto-fill step entirely and go straight to the builder.

### Changes

**`src/features/onboarding/steps/ProfilePreview.tsx`**
- Add a text-style "Skip" button below the "Auto-Populate My Profile" button in the `idle` state
- On click, calls `completeOnboarding()` and navigates to `/builder` (same logic as `handleComplete`)
- Styled as a subtle text link: `text-on-surface-variant text-xs font-bold uppercase tracking-[0.2em]` with hover underline — not competing with the primary CTA

