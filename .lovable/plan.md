

## Remove Duplicate "Your Card" Header

The preview column already displays "Identity Preview" above the card via `BuilderLayout.tsx`. The "Your Card" title + Draft/Live indicator row inside `ProCard.tsx` is redundant.

### Change

**`src/features/builder/components/ProCard.tsx`**

Remove the header row containing "Your Card" and the Draft/Live indicator (the `div` with `flex items-center justify-between` wrapping the h2 and status dot). Move the Draft/Live indicator up to `BuilderLayout.tsx`, positioned inline with the section label — label left-justified, status indicator right-justified on the same line.

**`src/features/builder/BuilderLayout.tsx`**

Update the section label row (line 41–43) from a single `<span>` to a flex row:
- Left: section label ("Identity Preview", etc.)
- Right: Draft/Live status indicator (green dot + "Live" or amber dot + "Draft"), reading `profileStatus` from `useAthleteStore`

This keeps the status visible across all sections, not just Identity — which makes more sense anyway since publish state applies to the whole profile.

### Files modified
- `src/features/builder/components/ProCard.tsx`
- `src/features/builder/BuilderLayout.tsx`

