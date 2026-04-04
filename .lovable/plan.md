

## Add Teal Hover Effect to College Tier Card

### What Changes
Apply the same teal hover styling from the RoleSelection "Athlete" card to the active "College" tier card in AthleteTier. Currently the College card has a plain `hover:border-outline-variant/30` — it should get the teal border and background treatment.

### Changes

**`src/features/onboarding/steps/AthleteTier.tsx`** (line 48)

Change the default (non-selected, active) card styling from:
```
border-outline-variant/10 bg-surface-container-high hover:border-outline-variant/30
```
to:
```
border-[#50C4CA]/40 bg-[rgba(80,196,202,0.05)] hover:border-[#50C4CA]/60
```

Also update the icon color (line 58) and label color (line 62) so the active College card always shows teal icon and label text — matching how the Athlete card looks on the role selection page:
- Icon: `color: t.active ? "#50C4CA" : undefined` (instead of only when selected)
- Label: add `style={{ color: t.active ? "#50C4CA" : undefined }}`

### Files Modified
- `src/features/onboarding/steps/AthleteTier.tsx`

