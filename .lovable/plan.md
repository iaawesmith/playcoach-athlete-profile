

## Match ProCard Size on Onboarding Preview + Update Title

### Problem
The mini ProCard on `/onboarding/preview` is `w-56` (~224px) — much smaller than the builder's `max-w-sm` (~384px) ProCard. This causes the action photo to render differently. The page title also doesn't communicate the auto-populate intent.

### Changes to `src/features/onboarding/steps/ProfilePreview.tsx`

1. **Replace the inline mini card with the actual `ProCard` component** — Import and render `<ProCard />` from `src/features/builder/components/ProCard.tsx` instead of the hand-built mini version. This guarantees identical sizing, photo fitting, and layout. Wrap it in a centered container with `max-w-sm mx-auto`.

2. **Update the page title** — Change "Your Profile Is Ready To Build" to **"Let's Auto-Populate Your Profile"** to better communicate what this step does.

3. **Remove the inline mini card markup** (lines 80–113) — replaced entirely by `<ProCard />`.

### Files Modified
- `src/features/onboarding/steps/ProfilePreview.tsx`

