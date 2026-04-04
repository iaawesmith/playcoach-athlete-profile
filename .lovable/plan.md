

## Add Teal Hover Effect to Active Sport Cards

### Change
Apply the same teal styling from RoleSelection and AthleteTier to the active "Football" card in SportSelection.

**`src/features/onboarding/steps/SportSelection.tsx`**

1. **Line 49** — Change the default active (non-selected) card styling from:
   `border-outline-variant/10 bg-surface-container-high hover:border-outline-variant/30`
   to:
   `border-[#50C4CA]/40 bg-[rgba(80,196,202,0.05)] hover:border-[#50C4CA]/60`

2. **Line 59** — Update icon color to show teal for all active cards:
   `color: s.active ? "#50C4CA" : undefined` (instead of only when selected)

3. **Line 63** — Update label text to teal for active cards:
   Add `style={{ color: s.active ? "#50C4CA" : undefined }}`

### Files Modified
- `src/features/onboarding/steps/SportSelection.tsx`

