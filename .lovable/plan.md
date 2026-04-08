

## Add Rank Badges Back to ProCard

The ProCard currently shows rank badges using `nationalRank` and `positionRank` (old CFBD fields). These need to be updated to use the new 247 transfer fields: `transferOvrRank247` and `transferPositionRank247`.

### Changes

**1. `src/features/builder/components/ProCard.tsx`**
- Add `transferOvrRank247` and `transferPositionRank247` to the store destructure (line 7)
- Replace the existing rank badges block (lines 114-128) to use:
  - First badge: `OVR #{transferOvrRank247}` — shows when `transferOvrRank247` exists
  - Second badge: `{position} #{transferPositionRank247}` — shows when `transferPositionRank247` exists, uses `position` from CFBD
- Remove `nationalRank` and `positionRank` from the destructure if no longer used elsewhere in this component

**2. `src/features/onboarding/steps/ProfilePreview.tsx`**
- The `ProfilePreview` already renders `<ProCard />` (line 60), so the badges will automatically appear there too — no additional changes needed since ProCard reads from the same Zustand store.

### Result
Both the builder card and the onboarding preview card will show:
- `OVR #6` badge (from `transferOvrRank247`)
- `QB #1` badge (from `transferPositionRank247`, with position label from CFBD)

Badges only render when values are non-null.

