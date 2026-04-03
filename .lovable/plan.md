

## Add Profile Picture Upload Box (3-Column Grid)

### Changes

**1. Add `profilePictureUrl` to Zustand store (`src/store/athleteStore.ts`)**
- Add `profilePictureUrl: string | null` to `AthleteState` interface
- Add default value `profilePictureUrl: null` to defaults

**2. Update `IdentityForm.tsx` upload section (lines 479–526)**
- Add a `profilePicInputRef` alongside existing refs
- Add `handleProfilePicUpload` handler (same pattern as photo/logo)
- Change grid from `grid-cols-2` to `grid-cols-3`
- Three boxes in order: **Action Photo** → **Profile Picture** → **School Logo**
- Profile Picture box uses `account_circle` icon, helper text: "Your headshot or portrait"
- All three boxes evenly distributed with same `gap-4`

### Files modified
- `src/store/athleteStore.ts`
- `src/features/builder/components/IdentityForm.tsx`

