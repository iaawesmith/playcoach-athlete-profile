

## Identity Editor Cleanup

Five changes, all in `IdentityForm.tsx` plus one small tweak in `ProCard.tsx`.

### 1. Rename group headers
- `"Card Fields"` → `"On Your Card"`
- `"Profile Fields"` → `"On Your Profile"`

### 2. Move Commitment Status from Eligibility to Recruiting
- Remove `CommitmentStatus` SelectCard from the Eligibility section
- Add it to the Recruiting section after the National Rank / Position Rank row

### 3. Merge Background into Story
- Delete the "Background" `<section>` and its `SectionHeader` entirely
- Add Hometown and High School as a `grid-cols-2` row at the bottom of the Story section (below Bio and Quote)

### 4. Reorder sub-sections to mirror preview column

**ON YOUR CARD:**
1. Your Identity (name, photos, school, color)
2. Position & Details (position chips, jersey, class year)
3. Measurables (height, weight, 40, vertical, wingspan, hand)

**ON YOUR PROFILE:**
1. Recruiting (star rating, national/position rank, commitment status)
2. Eligibility (years remaining, transfer eligible, redshirt status — no commitment)
3. Upcoming Game (opponent, date, time, network, location)
4. Story (bio, quote, hometown, high school)

### 5. Hide school logo placeholder on ProCard (`ProCard.tsx`)
- Wrap the logo container in a conditional: only render when `schoolLogoUrl` is truthy
- No placeholder icon when empty

### Files modified
- `src/features/builder/components/IdentityForm.tsx`
- `src/features/builder/components/ProCard.tsx`

